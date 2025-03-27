// 전역 변수 설정 (초기화 중복 방지 및 디버깅용)
window.elementsInitialized = false;

console.log('팝업 스크립트 로드됨');

// 팝업 창이 로드되면 실행됩니다
document.addEventListener('DOMContentLoaded', function() {
  console.log('팝업 DOM 로드됨');
  
  // 모든 UI 요소 초기화
  initButtons();
  
  // 분석 옵션 체크박스 설정
  setupAnalyzeOption();
  
  // 상태 메시지 표시
  showStatusMessage('벤치마킹 저장기가 준비되었습니다');
});

// 모든 버튼 초기화 및 이벤트 리스너 연결
function initButtons() {
  console.log('버튼 초기화 시작...');
  
  // 저장하기 버튼
  const saveButton = document.getElementById('save-btn');
  if (saveButton) {
    console.log('저장하기 버튼 이벤트 리스너 연결');
    saveButton.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('저장하기 버튼 클릭됨');
      saveWebsite();
    });
  } else {
    console.error('저장하기 버튼을 찾을 수 없습니다');
  }
  
  // 저장 목록 보기 버튼
  const viewDataButton = document.getElementById('view-data-btn');
  if (viewDataButton) {
    console.log('저장 목록 버튼 이벤트 리스너 연결');
    viewDataButton.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('저장 목록 버튼 클릭됨');
      openDataPage();
    });
  } else {
    console.error('저장 목록 버튼을 찾을 수 없습니다');
  }
  
  // CSV 내보내기 버튼
  const exportCsvButton = document.getElementById('export-csv-btn');
  if (exportCsvButton) {
    console.log('CSV 내보내기 버튼 이벤트 리스너 연결');
    exportCsvButton.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('CSV 내보내기 버튼 클릭됨');
      exportCSV();
    });
  } else {
    console.error('CSV 내보내기 버튼을 찾을 수 없습니다');
  }
}

// 분석 옵션 체크박스 설정
function setupAnalyzeOption() {
  const analyzeContent = document.getElementById('analyze-content');
  const apiKeySection = document.getElementById('api-key-section');
  const apiKeyInput = document.getElementById('api-key');
  const saveApiKeyBtn = document.getElementById('save-api-key');
  
  if (analyzeContent && apiKeySection) {
    analyzeContent.addEventListener('change', function() {
      apiKeySection.style.display = this.checked ? 'block' : 'none';
      
      if (this.checked && apiKeyInput) {
        chrome.storage.local.get('openai_api_key', function(data) {
          if (data.openai_api_key) {
            apiKeyInput.value = data.openai_api_key;
          }
        });
      }
    });
  }
  
  if (saveApiKeyBtn && apiKeyInput) {
    saveApiKeyBtn.addEventListener('click', function() {
      const apiKey = apiKeyInput.value.trim();
      
      if (apiKey) {
        chrome.storage.local.set({openai_api_key: apiKey}, function() {
          showStatusMessage('API 키가 저장되었습니다');
        });
      } else {
        showStatusMessage('API 키를 입력해주세요');
      }
    });
  }
}

// 웹사이트 정보 저장 함수
function saveWebsite() {
  console.log('웹사이트 저장 시작...');
  
  // UI 요소 값 가져오기
  const category = document.getElementById('category')?.value || 'other';
  const notes = document.getElementById('notes')?.value || '';
  const saveTitle = document.getElementById('save-title')?.checked || false;
  const saveUrl = document.getElementById('save-url')?.checked || false;
  const saveDesc = document.getElementById('save-desc')?.checked || false;
  const saveScreenshot = document.getElementById('save-screenshot')?.checked || false;
  const analyzeContent = document.getElementById('analyze-content')?.checked || false;
  
  // 상태 메시지 표시
  showStatusMessage('정보 저장 중...');
  
  // 현재 활성화된 탭 정보 가져오기
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs || tabs.length === 0) {
      showStatusMessage('오류: 탭 정보를 가져올 수 없습니다');
      return;
    }
    
    const currentTab = tabs[0];
    
    // 저장할 데이터 객체 생성
    const websiteData = {
      id: Date.now(),
      date: new Date().toISOString(),
      category: category,
      notes: notes,
      title: saveTitle ? currentTab.title : '',
      url: saveUrl ? currentTab.url : '',
      description: ''
    };
    
    console.log('저장할 데이터:', websiteData);
    
    // 페이지 콘텐츠 분석 여부 확인
    if (analyzeContent) {
      // 콘텐츠 분석 진행
      getContentAndAnalyze(websiteData, currentTab, saveDesc, saveScreenshot);
    } else {
      // 설명 가져오기
      if (saveDesc) {
        getPageDescription(websiteData, saveScreenshot, currentTab.id);
      } else {
        // 바로 저장
        completeDataSave(websiteData, saveScreenshot, currentTab.id);
      }
    }
  });
}

// 페이지 콘텐츠 가져오고 분석하는 함수
function getContentAndAnalyze(websiteData, tab, saveDesc, saveScreenshot) {
  try {
    chrome.scripting.executeScript({
      target: {tabId: tab.id},
      function: extractPageContent
    }, (results) => {
      if (results && results[0] && results[0].result) {
        const pageData = results[0].result;
        
        // 추출된 콘텐츠 저장
        websiteData.extractedContent = pageData.content?.substring(0, 5000) || '';
        websiteData.mediaInfo = pageData.mediaInfo || {};
        websiteData.mediaInfoSummary = summarizeMediaInfo(pageData.mediaInfo);
        
        // API 키 확인 후 분석 진행
        chrome.storage.local.get('openai_api_key', function(data) {
          if (data.openai_api_key && data.openai_api_key.trim() !== '') {
            // OpenAI로 분석 시작
            analyzeWithOpenAI(websiteData, tab, saveDesc, saveScreenshot, data.openai_api_key);
          } else {
            // API 키 없이 콘텐츠만 저장
            if (saveDesc) {
              getPageDescription(websiteData, saveScreenshot, tab.id);
            } else {
              completeDataSave(websiteData, saveScreenshot, tab.id);
            }
          }
        });
      } else {
        showStatusMessage('콘텐츠 추출 실패');
        // 기본 저장 진행
        if (saveDesc) {
          getPageDescription(websiteData, saveScreenshot, tab.id);
        } else {
          completeDataSave(websiteData, saveScreenshot, tab.id);
        }
      }
    });
  } catch (error) {
    console.error('스크립트 실행 오류:', error);
    showStatusMessage('오류: ' + error.message);
    
    // 오류 발생 시 기본 저장 진행
    if (saveDesc) {
      getPageDescription(websiteData, saveScreenshot, tab.id);
    } else {
      completeDataSave(websiteData, saveScreenshot, tab.id);
    }
  }
}

// 페이지 콘텐츠 추출 함수 (탭에서 실행)
function extractPageContent() {
  try {
    // 미디어 정보 수집
    const mediaInfo = {
      images: [],
      videos: [],
      socialMedia: {}
    };
    
    // 이미지 정보 수집
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (img.width > 100 && img.height > 100) {
        mediaInfo.images.push({
          src: img.src,
          alt: img.alt,
          width: img.width,
          height: img.height
        });
      }
    });
    
    // 비디오 정보 수집
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      mediaInfo.videos.push({
        type: video.getAttribute('type') || 'unknown',
        width: video.width,
        height: video.height
      });
    });
    
    // 사이트 이름 예측
    let siteName = '';
    const siteNameMeta = document.querySelector('meta[property="og:site_name"]');
    if (siteNameMeta) {
      siteName = siteNameMeta.getAttribute('content');
    } else {
      // 도메인에서 사이트 이름 추출
      siteName = window.location.hostname.replace('www.', '').split('.')[0];
    }
    
    return {
      content: document.body.innerText || document.documentElement.innerText,
      mediaInfo: mediaInfo,
      siteName: siteName
    };
  } catch (error) {
    console.error('콘텐츠 추출 오류:', error);
    return {
      content: '오류: ' + error.message,
      mediaInfo: { images: [], videos: [] },
      siteName: window.location.hostname
    };
  }
}

// 페이지 설명 가져오기
function getPageDescription(websiteData, saveScreenshot, tabId) {
  try {
    chrome.scripting.executeScript({
      target: {tabId: tabId},
      function: extractMetaDescription
    }, (results) => {
      if (results && results[0] && results[0].result) {
        websiteData.description = results[0].result;
      }
      
      completeDataSave(websiteData, saveScreenshot, tabId);
    });
  } catch (error) {
    console.error('메타 설명 추출 오류:', error);
    completeDataSave(websiteData, saveScreenshot, tabId);
  }
}

// 메타 설명 추출 함수 (탭에서 실행)
function extractMetaDescription() {
  const metaDesc = document.querySelector('meta[name="description"]') || 
                  document.querySelector('meta[property="og:description"]');
  
  return metaDesc ? metaDesc.getAttribute('content') : '';
}

// OpenAI로 분석하기
function analyzeWithOpenAI(websiteData, tab, saveDesc, saveScreenshot, apiKey) {
  // 분석 중임을 표시
  document.getElementById('analysis-section').style.display = 'block';
  document.getElementById('analysis-loading').style.display = 'block';
  document.getElementById('analysis-result').textContent = '';
  
  // 프롬프트 생성
  const prompt = `
웹페이지 분석:
제목: ${websiteData.title}
URL: ${websiteData.url}
카테고리: ${websiteData.category}

콘텐츠: ${websiteData.extractedContent.substring(0, 1500)}

미디어 정보: ${websiteData.mediaInfoSummary}

이 웹사이트를 벤치마킹 관점에서 분석해주세요. 디자인, 콘텐츠, UI/UX, 마케팅 전략 등의 관점에서 500자 내외로 요약해주세요.
`;

  // OpenAI API 호출
  fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "당신은 웹사이트 분석 전문가입니다. 마케팅과 디자인 관점에서 유용한 인사이트를 제공해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.7
    })
  })
  .then(response => response.json())
  .then(data => {
    document.getElementById('analysis-loading').style.display = 'none';
    
    if (data.error) {
      document.getElementById('analysis-result').textContent = `분석 오류: ${data.error.message}`;
      console.error('OpenAI API 오류:', data.error);
    } else if (data.choices && data.choices[0]) {
      const analysis = data.choices[0].message.content;
      document.getElementById('analysis-result').textContent = analysis;
      websiteData.analysis = analysis;
    }
    
    // 분석 완료 후 메타 설명 가져오기
    if (saveDesc) {
      getPageDescription(websiteData, saveScreenshot, tab.id);
    } else {
      completeDataSave(websiteData, saveScreenshot, tab.id);
    }
  })
  .catch(error => {
    console.error('API 호출 오류:', error);
    document.getElementById('analysis-loading').style.display = 'none';
    document.getElementById('analysis-result').textContent = `분석 오류: ${error.message}`;
    
    // 오류 발생 시에도 계속 진행
    if (saveDesc) {
      getPageDescription(websiteData, saveScreenshot, tab.id);
    } else {
      completeDataSave(websiteData, saveScreenshot, tab.id);
    }
  });
}

// 미디어 정보 요약
function summarizeMediaInfo(mediaInfo) {
  if (!mediaInfo) return '';
  
  let summary = [];
  
  if (mediaInfo.images && mediaInfo.images.length > 0) {
    summary.push(`이미지 ${mediaInfo.images.length}개`);
  }
  
  if (mediaInfo.videos && mediaInfo.videos.length > 0) {
    summary.push(`비디오 ${mediaInfo.videos.length}개`);
  }
  
  return summary.join(', ');
}

// 최종 데이터 저장 (스크린샷 포함)
function completeDataSave(websiteData, saveScreenshot, tabId) {
  if (saveScreenshot) {
    captureScreenshot(tabId, function(dataUrl) {
      websiteData.screenshot = dataUrl;
      saveToStorage(websiteData);
    });
  } else {
    saveToStorage(websiteData);
  }
}

// 스크린샷 캡처
function captureScreenshot(tabId, callback) {
  try {
    chrome.tabs.captureVisibleTab(null, {format: 'jpeg', quality: 70}, function(dataUrl) {
      if (chrome.runtime.lastError) {
        console.error('스크린샷 캡처 오류:', chrome.runtime.lastError);
        callback(null);
        return;
      }
      callback(dataUrl);
    });
  } catch (error) {
    console.error('스크린샷 캡처 중 예외 발생:', error);
    callback(null);
  }
}

// 스토리지에 저장
function saveToStorage(websiteData) {
  chrome.storage.local.get('websites', function(data) {
    const websites = data.websites || [];
    websites.unshift(websiteData); // 맨 앞에 추가
    
    chrome.storage.local.set({websites: websites}, function() {
      if (chrome.runtime.lastError) {
        showStatusMessage('저장 오류: ' + chrome.runtime.lastError.message);
      } else {
        showStatusMessage('웹사이트가 저장되었습니다!');
      }
    });
  });
}

// 저장 목록 페이지 열기
function openDataPage() {
  console.log('저장 목록 페이지 열기 시도...');
  chrome.tabs.create({url: 'data.html'});
}

// CSV 내보내기
function exportCSV() {
  console.log('CSV 내보내기 시도...');
  chrome.tabs.create({url: 'data.html?action=exportcsv'});
  showStatusMessage('CSV 내보내기 페이지를 열었습니다');
}

// 상태 메시지 표시
function showStatusMessage(message) {
  console.log('상태 메시지:', message);
  const statusElement = document.getElementById('status-message');
  
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.style.opacity = '1';
    
    setTimeout(() => {
      statusElement.style.opacity = '0';
    }, 3000);
  }
}