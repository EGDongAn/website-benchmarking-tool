// 저장 버튼 클릭 이벤트
document.getElementById('save-btn').addEventListener('click', saveWebsite);
// CSV 내보내기 버튼 클릭 이벤트
document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
// 저장 목록 보기 버튼 클릭 이벤트
document.getElementById('view-data-btn').addEventListener('click', openDataPage);

// 새로운 이벤트 리스너 추가
document.getElementById('analyze-content').addEventListener('change', function() {
  const apiKeySection = document.getElementById('api-key-section');
  
  if (this.checked) {
    apiKeySection.style.display = 'block';
    // API 키 확인
    chrome.storage.local.get('openai_api_key', function(data) {
      if (data.openai_api_key) {
        document.getElementById('api-key').value = data.openai_api_key;
      }
    });
  } else {
    apiKeySection.style.display = 'none';
  }
});

document.getElementById('save-api-key').addEventListener('click', function() {
  const apiKey = document.getElementById('api-key').value.trim();
  
  if (apiKey) {
    chrome.storage.local.set({openai_api_key: apiKey}, function() {
      showStatusMessage('API 키가 저장되었습니다.');
    });
  } else {
    showStatusMessage('API 키를 입력해주세요.');
  }
});

// 웹사이트 정보 저장 함수
function saveWebsite() {
  const category = document.getElementById('category').value;
  const notes = document.getElementById('notes').value;
  const saveTitle = document.getElementById('save-title').checked;
  const saveUrl = document.getElementById('save-url').checked;
  const saveDesc = document.getElementById('save-desc').checked;
  const saveScreenshot = document.getElementById('save-screenshot').checked;
  const analyzeContent = document.getElementById('analyze-content').checked;
  
  // 현재 활성화된 탭 정보 가져오기
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
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
    
    // 페이지 콘텐츠 분석 실행
    if (analyzeContent) {
      // 페이지 콘텐츠 가져오기
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        function: getPageContent
      }, (results) => {
        if (results && results[0]) {
          const pageContent = results[0].result || '';
          analyzePageContent(pageContent, currentTab.title, currentTab.url, websiteData, saveScreenshot, currentTab.id);
        } else {
          showStatusMessage('페이지 콘텐츠를 가져오는데 실패했습니다.');
          if (saveDesc) {
            getDescription(websiteData, saveScreenshot, currentTab.id);
          } else {
            saveData(websiteData, saveScreenshot, currentTab.id);
          }
        }
      });
    } else {
      // 기존 로직 (설명만 가져오기)
      if (saveDesc) {
        getDescription(websiteData, saveScreenshot, currentTab.id);
      } else {
        saveData(websiteData, saveScreenshot, currentTab.id);
      }
    }
  });
}

// 페이지 설명 가져오기 함수
function getDescription(websiteData, saveScreenshot, tabId) {
  chrome.scripting.executeScript({
    target: {tabId: tabId},
    function: getMetaDescription
  }, (results) => {
    if (results && results[0]) {
      websiteData.description = results[0].result || '';
    }
    saveData(websiteData, saveScreenshot, tabId);
  });
}

// 메타 설명 추출 함수
function getMetaDescription() {
  const metaDesc = document.querySelector('meta[name="description"]');
  return metaDesc ? metaDesc.getAttribute('content') : '';
}

// 페이지 콘텐츠 가져오기 함수 개선
function getPageContent() {
  // title과 메인 콘텐츠 가져오기
  const title = document.title;
  
  // 메인 콘텐츠 추출 시도 (일반적인 콘텐츠 영역 선택)
  let content = '';
  
  // 이미지 및 비디오 정보 수집
  const mediaInfo = {
    images: [],
    videos: []
  };
  
  // 주요 이미지 추출 (큰 이미지 위주)
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    // 충분히 큰 이미지만 수집 (작은 아이콘 제외)
    if (img.width >= 200 && img.height >= 150) {
      mediaInfo.images.push({
        src: img.src,
        alt: img.alt || '',
        width: img.width,
        height: img.height
      });
    }
  });
  
  // YouTube 비디오 추출
  const youtubeVideos = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
  youtubeVideos.forEach(video => {
    mediaInfo.videos.push({
      type: 'youtube',
      src: video.src,
      width: video.width,
      height: video.height
    });
  });
  
  // HTML5 비디오 추출
  const html5Videos = document.querySelectorAll('video');
  html5Videos.forEach(video => {
    const sources = video.querySelectorAll('source');
    const srcList = [];
    
    sources.forEach(source => {
      srcList.push(source.src);
    });
    
    mediaInfo.videos.push({
      type: 'html5',
      src: video.src || (srcList.length > 0 ? srcList[0] : ''),
      sources: srcList,
      width: video.width,
      height: video.height,
      poster: video.poster || ''
    });
  });
  
  // 소셜 미디어 특화 처리
  // Instagram 포스트 정보
  const instagramInfo = getInstagramInfo();
  if (instagramInfo) {
    mediaInfo.socialMedia = {...mediaInfo.socialMedia, ...instagramInfo};
  }
  
  // Twitter(X)/Thread 포스트 정보
  const twitterInfo = getTwitterInfo();
  if (twitterInfo) {
    mediaInfo.socialMedia = {...mediaInfo.socialMedia, ...twitterInfo};
  }
  
  // article, main, section 등 주요 콘텐츠 영역 탐색
  const mainElements = document.querySelectorAll('article, main, section, .content, #content, .post, .article');
  
  if (mainElements.length > 0) {
    // 텍스트 콘텐츠가 가장 많은 요소 찾기
    let bestElement = null;
    let maxLength = 0;
    
    mainElements.forEach(element => {
      const text = element.textContent.trim();
      if (text.length > maxLength) {
        maxLength = text.length;
        bestElement = element;
      }
    });
    
    if (bestElement) {
      content = bestElement.textContent.trim();
    }
  }
  
  // 콘텐츠를 찾지 못했다면 body 전체에서 텍스트 추출
  if (!content) {
    content = document.body.textContent.trim();
  }
  
  // 너무 긴 콘텐츠는 잘라내기 (OpenAI API 토큰 제한)
  const maxChars = 5000;
  if (content.length > maxChars) {
    content = content.substring(0, maxChars) + '... (더 많은 콘텐츠가 있습니다)';
  }
  
  return {
    title: title,
    content: content,
    mediaInfo: mediaInfo,
    url: window.location.href,
    siteName: getSiteName()
  };
}

// 사이트 이름 추출
function getSiteName() {
  // 메타 태그에서 사이트 이름 찾기
  const metaSiteName = document.querySelector('meta[property="og:site_name"]');
  if (metaSiteName) {
    return metaSiteName.getAttribute('content');
  }
  
  // 도메인에서 사이트 이름 추출
  const hostname = window.location.hostname;
  return hostname.replace('www.', '').split('.')[0];
}

// Instagram 정보 추출
function getInstagramInfo() {
  if (window.location.hostname.includes('instagram.com')) {
    const authorElement = document.querySelector('a.x1i10hfl[href^="/"]');
    const captionElement = document.querySelector('h1._aacl._aaco._aacu._aacx._aad7._aade, div._a9zs');
    const likesElement = document.querySelector('div._aacl._aaco._aacw._aacx._aada._aade span');
    
    return {
      instagram: {
        author: authorElement ? authorElement.textContent.trim() : '',
        caption: captionElement ? captionElement.textContent.trim() : '',
        likes: likesElement ? likesElement.textContent.trim() : '',
        isInstaPost: true
      }
    };
  }
  return null;
}

// Twitter(X)/Thread 정보 추출
function getTwitterInfo() {
  if (window.location.hostname.includes('twitter.com') || 
      window.location.hostname.includes('x.com') ||
      window.location.hostname.includes('threads.net')) {
    
    const authorElement = document.querySelector('div[data-testid="User-Name"], a[role="link"][href^="/"]');
    const tweetTextElement = document.querySelector('div[data-testid="tweetText"], article');
    const statsElement = document.querySelector('div[role="group"]');
    
    return {
      twitter: {
        author: authorElement ? authorElement.textContent.trim() : '',
        tweetText: tweetTextElement ? tweetTextElement.textContent.trim() : '',
        stats: statsElement ? statsElement.textContent.trim() : '',
        isTweet: true
      }
    };
  }
  return null;
}

// 페이지 콘텐츠 분석 함수
function analyzePageContent(pageContent, title, url, websiteData, saveScreenshot, tabId) {
  // 미디어 정보 저장
  websiteData.mediaInfo = pageContent.mediaInfo;
  websiteData.siteName = pageContent.siteName;
  
  // API 키 가져오기
  chrome.storage.local.get('openai_api_key', function(data) {
    const apiKey = data.openai_api_key;
    
    if (!apiKey || apiKey.trim() === '') {
      // API 키가 없을 경우 - 콘텐츠 저장만 진행
      websiteData.extractedContent = pageContent.content.substring(0, 5000); // 5000자 제한
      
      // 미디어 정보를 요약해서 추가
      websiteData.mediaInfoSummary = summarizeMediaInfo(pageContent.mediaInfo);
      
      // 분석 섹션 표시
      document.getElementById('analysis-section').style.display = 'block';
      document.getElementById('analysis-loading').style.display = 'none';
      document.getElementById('analysis-result').textContent = 
        '추출된 콘텐츠는 데이터로 저장되었습니다. GPTs에서 별도로 분석해주세요.\n\n' + 
        '콘텐츠 일부 미리보기:\n' + websiteData.extractedContent.substring(0, 300) + '...\n\n' +
        '미디어 정보:\n' + websiteData.mediaInfoSummary;
      
      if (websiteData.description === '') {
        getDescription(websiteData, saveScreenshot, tabId);
      } else {
        saveData(websiteData, saveScreenshot, tabId);
      }
      
      return;
    }
    
    // API 키가 있는 경우 기존 OpenAI 분석 진행
    // 분석 섹션 표시
    document.getElementById('analysis-section').style.display = 'block';
    document.getElementById('analysis-loading').style.display = 'block';
    document.getElementById('analysis-result').textContent = '';
    
    // 미디어 정보를 포함한 프롬프트 생성
    const mediaInfoText = generateMediaInfoText(pageContent.mediaInfo);
    
    // OpenAI API 호출
    const prompt = `
다음 웹페이지를 벤치마킹 관점에서 분석해주세요:

제목: ${title}
URL: ${url}
사이트: ${pageContent.siteName}
카테고리: ${websiteData.category}

${mediaInfoText}

콘텐츠:
${pageContent.content}

다음 내용을 포함하여 분석해주세요:
1. 이 웹사이트/페이지의 주요 목적과 타겟 오디언스
2. 디자인과 UI/UX 측면에서 강점
3. 콘텐츠 측면에서 강점과 특징 (텍스트, 이미지, 영상 모두 고려)
4. 어떤 마케팅/소통 전략을 사용하고 있는지
5. 벤치마킹할 때 참고할 만한 핵심 요소
6. 개선할 점이나 차별화할 수 있는 부분

위 페이지에 이미지나 영상이 있다면 그 내용과 활용 방식에 대해서도 분석해주세요.
분석은 최대 500단어로 요약해주세요.
`;

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
            content: "당신은 마케팅과 웹사이트 분석 전문가입니다. 웹사이트의 텍스트뿐만 아니라 이미지, 영상 콘텐츠까지 분석하고 벤치마킹 관점에서 유용한 인사이트를 제공해주세요."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    })
    .then(response => response.json())
    .then(data => {
      document.getElementById('analysis-loading').style.display = 'none';
      
      if (data.error) {
        document.getElementById('analysis-result').textContent = `분석 에러: ${data.error.message}`;
        saveData(websiteData, saveScreenshot, tabId);
        return;
      }
      
      const analysis = data.choices[0].message.content;
      document.getElementById('analysis-result').textContent = analysis;
      
      // 분석 결과 저장
      websiteData.analysis = analysis;
      websiteData.mediaInfoSummary = summarizeMediaInfo(pageContent.mediaInfo);
      
      // 설명 가져오기
      if (websiteData.description === '') {
        getDescription(websiteData, saveScreenshot, tabId);
      } else {
        saveData(websiteData, saveScreenshot, tabId);
      }
    })
    .catch(error => {
      document.getElementById('analysis-loading').style.display = 'none';
      document.getElementById('analysis-result').textContent = `분석 에러: ${error.message}`;
      saveData(websiteData, saveScreenshot, tabId);
    });
  });
}

// 미디어 정보 텍스트 생성 함수
function generateMediaInfoText(mediaInfo) {
  let mediaText = "페이지 미디어 정보:\n";
  
  // 이미지 정보
  if (mediaInfo.images && mediaInfo.images.length > 0) {
    mediaText += `- 이미지: ${mediaInfo.images.length}개 발견\n`;
    
    // 최대 5개까지만 상세 정보 제공
    const maxImages = Math.min(5, mediaInfo.images.length);
    for (let i = 0; i < maxImages; i++) {
      const img = mediaInfo.images[i];
      mediaText += `  * 이미지 ${i+1}: ${img.width}x${img.height}px ${img.alt ? '(설명: ' + img.alt + ')' : ''}\n`;
    }
  } else {
    mediaText += "- 이미지: 없음\n";
  }
  
  // 비디오 정보
  if (mediaInfo.videos && mediaInfo.videos.length > 0) {
    mediaText += `- 비디오: ${mediaInfo.videos.length}개 발견\n`;
    
    mediaInfo.videos.forEach((video, index) => {
      mediaText += `  * 비디오 ${index+1}: ${video.type} 형식 ${video.width ? video.width+'x'+video.height+'px' : ''}\n`;
    });
  } else {
    mediaText += "- 비디오: 없음\n";
  }
  
  // 소셜 미디어 정보
  if (mediaInfo.socialMedia) {
    mediaText += "- 소셜 미디어 정보:\n";
    
    if (mediaInfo.socialMedia.instagram) {
      const ig = mediaInfo.socialMedia.instagram;
      mediaText += `  * Instagram 포스트: ${ig.author ? '작성자: ' + ig.author : ''}\n`;
      if (ig.caption) {
        mediaText += `    캡션: ${ig.caption.substring(0, 100)}${ig.caption.length > 100 ? '...' : ''}\n`;
      }
    }
    
    if (mediaInfo.socialMedia.twitter) {
      const tw = mediaInfo.socialMedia.twitter;
      mediaText += `  * Twitter/Thread 포스트: ${tw.author ? '작성자: ' + tw.author : ''}\n`;
      if (tw.tweetText) {
        mediaText += `    내용: ${tw.tweetText.substring(0, 100)}${tw.tweetText.length > 100 ? '...' : ''}\n`;
      }
    }
  }
  
  return mediaText;
}

// 미디어 정보 요약 함수 (CSV 내보내기용)
function summarizeMediaInfo(mediaInfo) {
  if (!mediaInfo) return '';
  
  let summary = '';
  
  // 이미지 정보
  if (mediaInfo.images && mediaInfo.images.length > 0) {
    summary += `이미지 ${mediaInfo.images.length}개, `;
  }
  
  // 비디오 정보
  if (mediaInfo.videos && mediaInfo.videos.length > 0) {
    summary += `비디오 ${mediaInfo.videos.length}개, `;
  }
  
  // 소셜 미디어 정보
  if (mediaInfo.socialMedia) {
    if (mediaInfo.socialMedia.instagram) {
      summary += `Instagram 포스트, `;
    }
    
    if (mediaInfo.socialMedia.twitter) {
      summary += `Twitter/Thread 포스트, `;
    }
  }
  
  // 마지막 쉼표와 공백 제거
  summary = summary.replace(/, $/, '');
  
  return summary || '미디어 없음';
}

// 데이터 저장 함수
function saveData(websiteData, saveScreenshot, tabId) {
  // 스크린샷 캡처
  if (saveScreenshot) {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
      websiteData.screenshot = dataUrl;
      storeDataInStorage(websiteData);
    });
  } else {
    websiteData.screenshot = '';
    storeDataInStorage(websiteData);
  }
}

// 스토리지에 데이터 저장
function storeDataInStorage(websiteData) {
  chrome.storage.local.get('websites', function(data) {
    const websites = data.websites || [];
    websites.push(websiteData);
    
    chrome.storage.local.set({websites: websites}, function() {
      showStatusMessage('웹사이트가 성공적으로 저장되었습니다!');
    });
  });
}

// 상태 메시지 표시 함수
function showStatusMessage(message) {
  const statusElement = document.getElementById('status-message');
  statusElement.textContent = message;
  
  setTimeout(() => {
    statusElement.textContent = '';
  }, 3000);
}

// CSV 내보내기 함수
function exportCSV() {
  chrome.storage.local.get('websites', function(data) {
    const websites = data.websites || [];
    
    if (websites.length === 0) {
      showStatusMessage('저장된 웹사이트가 없습니다.');
      return;
    }
    
    // CSV 헤더 생성
    let csvContent = 'ID,날짜,카테고리,제목,URL,설명,메모\n';
    
    // 각 항목을 CSV 행으로 변환
    websites.forEach(site => {
      const row = [
        site.id,
        site.date,
        site.category,
        `"${site.title.replace(/"/g, '""')}"`,
        `"${site.url}"`,
        `"${site.description.replace(/"/g, '""')}"`,
        `"${site.notes.replace(/"/g, '""')}"`
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // CSV 파일 다운로드
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    
    chrome.downloads.download({
      url: url,
      filename: `웹사이트_벤치마킹_${date}.csv`,
      saveAs: true
    });
  });
}

// 데이터 페이지 열기 함수
function openDataPage() {
  chrome.tabs.create({url: 'data.html'});
} 