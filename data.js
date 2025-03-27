document.addEventListener('DOMContentLoaded', function() {
  // 초기 데이터 로드
  loadWebsites();
  
  // 필터 변경 이벤트 리스너
  document.getElementById('category-filter').addEventListener('change', loadWebsites);
  
  // 검색 입력 이벤트 리스너
  document.getElementById('search-input').addEventListener('input', loadWebsites);
  
  // CSV 내보내기 버튼 이벤트 리스너
  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
  
  // HTML 내보내기 버튼 이벤트 리스너
  document.getElementById('export-html-btn').addEventListener('click', exportHTML);
  
  // URL 파라미터 체크하여 자동 CSV 내보내기
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'exportcsv') {
    setTimeout(function() {
      exportCSV();
    }, 1000); // 데이터 로드 후 CSV 내보내기 실행
  }
});

// 웹사이트 데이터 로드 함수
function loadWebsites() {
  const categoryFilter = document.getElementById('category-filter').value;
  const searchQuery = document.getElementById('search-input').value.toLowerCase();
  
  chrome.storage.local.get('websites', function(data) {
    const websites = data.websites || [];
    const websitesContainer = document.getElementById('websites-container');
    
    // 컨테이너 초기화
    websitesContainer.innerHTML = '';
    
    // 필터링된 웹사이트 목록
    let filteredWebsites = websites;
    
    // 카테고리 필터 적용
    if (categoryFilter !== 'all') {
      filteredWebsites = filteredWebsites.filter(site => site.category === categoryFilter);
    }
    
    // 검색 필터 적용
    if (searchQuery) {
      filteredWebsites = filteredWebsites.filter(site => 
        site.title.toLowerCase().includes(searchQuery) ||
        site.url.toLowerCase().includes(searchQuery) ||
        site.description.toLowerCase().includes(searchQuery) ||
        site.notes.toLowerCase().includes(searchQuery)
      );
    }
    
    // 결과가 없는 경우
    if (filteredWebsites.length === 0) {
      websitesContainer.innerHTML = '<div class="no-websites">저장된 웹사이트가 없습니다.</div>';
      return;
    }
    
    // 웹사이트 카드 생성 및 표시
    filteredWebsites.forEach(site => {
      const websiteCard = createWebsiteCard(site);
      websitesContainer.appendChild(websiteCard);
    });
  });
}

// 웹사이트 카드 생성 함수
function createWebsiteCard(site) {
  const card = document.createElement('div');
  card.className = 'website-card';
  card.dataset.id = site.id;
  
  // 포맷된 날짜
  const date = new Date(site.date);
  const formattedDate = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  
  // 카테고리 한글 매핑
  const categoryMap = {
    'sns': 'SNS',
    'blog': '블로그',
    'homepage': '홈페이지',
    'other': '기타'
  };
  
  // 카드 내용 설정
  card.innerHTML = `
    ${site.screenshot ? `<img src="${site.screenshot}" class="website-screenshot" alt="웹사이트 스크린샷">` : ''}
    <div class="website-info">
      <div class="website-title">${site.title || '(제목 없음)'}</div>
      <a href="${site.url}" class="website-url" target="_blank">${site.url}</a>
      <div class="website-category">${categoryMap[site.category] || site.category}</div>
      ${site.description ? `<div class="website-desc">${site.description}</div>` : ''}
      ${site.notes ? `<div class="website-notes">${site.notes}</div>` : ''}
      
      ${site.mediaInfoSummary ? `<div class="website-media-info">미디어: ${site.mediaInfoSummary}</div>` : ''}
      
      ${site.analysis ? `
        <div class="website-analysis-toggle">벤치마킹 분석 결과 <span>▼</span></div>
        <div class="website-analysis">${site.analysis.replace(/\n/g, '<br>')}</div>
      ` : ''}
      
      ${site.extractedContent && !site.analysis ? `
        <div class="website-analysis-toggle">추출된 콘텐츠 <span>▼</span></div>
        <div class="website-analysis">${site.extractedContent.substring(0, 500).replace(/\n/g, '<br>')}...</div>
      ` : ''}
      
      <div class="website-date">${formattedDate}</div>
      <div class="website-actions">
        <button class="visit-btn" data-url="${site.url}">방문하기</button>
        <button class="copy-btn" data-url="${site.url}" data-title="${site.title || ''}">링크 복사</button>
        <button class="delete-btn" data-id="${site.id}">삭제</button>
      </div>
    </div>
  `;
  
  // 분석 결과 토글 기능
  const analysisToggle = card.querySelector('.website-analysis-toggle');
  if (analysisToggle) {
    analysisToggle.addEventListener('click', function() {
      const analysisContent = this.nextElementSibling;
      const toggleIndicator = this.querySelector('span');
      
      if (analysisContent.style.display === 'none' || !analysisContent.style.display) {
        analysisContent.style.display = 'block';
        toggleIndicator.textContent = '▲';
      } else {
        analysisContent.style.display = 'none';
        toggleIndicator.textContent = '▼';
      }
    });
    
    // 초기 상태는 접혀있음
    card.querySelector('.website-analysis').style.display = 'none';
  }
  
  // 방문하기 버튼 이벤트
  card.querySelector('.visit-btn').addEventListener('click', function() {
    chrome.tabs.create({url: this.dataset.url});
  });
  
  // 삭제 버튼 이벤트
  card.querySelector('.delete-btn').addEventListener('click', function() {
    deleteWebsite(this.dataset.id);
  });
  
  // 링크 복사 버튼 이벤트
  card.querySelector('.copy-btn').addEventListener('click', function() {
    const url = this.dataset.url;
    const title = this.dataset.title;
    
    // 링크를 마크다운 형식으로 복사
    const linkText = title ? `[${title}](${url})` : url;
    
    // 클립보드에 복사
    navigator.clipboard.writeText(linkText).then(() => {
      // 버튼 텍스트 일시적으로 변경하여 피드백 제공
      const originalText = this.textContent;
      this.textContent = '복사됨!';
      this.classList.add('copied');
      
      setTimeout(() => {
        this.textContent = originalText;
        this.classList.remove('copied');
      }, 2000);
    }).catch(err => {
      console.error('클립보드 복사 실패:', err);
      alert('링크 복사에 실패했습니다.');
    });
  });
  
  return card;
}

// 웹사이트 삭제 함수
function deleteWebsite(id) {
  if (confirm('이 웹사이트를 삭제하시겠습니까?')) {
    chrome.storage.local.get('websites', function(data) {
      const websites = data.websites || [];
      const updatedWebsites = websites.filter(site => site.id.toString() !== id.toString());
      
      chrome.storage.local.set({websites: updatedWebsites}, function() {
        loadWebsites();
      });
    });
  }
}

// CSV 내보내기 함수
function exportCSV() {
  const categoryFilter = document.getElementById('category-filter').value;
  const searchQuery = document.getElementById('search-input').value.toLowerCase();
  
  chrome.storage.local.get('websites', function(data) {
    let websites = data.websites || [];
    
    // 현재 필터에 맞는 데이터만 내보내기
    if (categoryFilter !== 'all') {
      websites = websites.filter(site => site.category === categoryFilter);
    }
    
    if (searchQuery) {
      websites = websites.filter(site => 
        site.title.toLowerCase().includes(searchQuery) ||
        site.url.toLowerCase().includes(searchQuery) ||
        site.description.toLowerCase().includes(searchQuery) ||
        site.notes.toLowerCase().includes(searchQuery)
      );
    }
    
    if (websites.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }
    
    // CSV 헤더 생성
    let csvContent = 'ID,날짜,카테고리,제목,URL,설명,메모,분석결과,추출콘텐츠,미디어정보\n';
    
    // 각 항목을 CSV 행으로 변환
    websites.forEach(site => {
      const row = [
        site.id,
        site.date,
        site.category,
        `"${site.title.replace(/"/g, '""')}"`,
        `"${site.url}"`,
        `"${site.description.replace(/"/g, '""')}"`,
        `"${site.notes.replace(/"/g, '""')}"`,
        `"${site.analysis ? site.analysis.replace(/"/g, '""') : ''}"`,
        `"${site.extractedContent ? site.extractedContent.replace(/"/g, '""') : ''}"`,
        `"${site.mediaInfoSummary ? site.mediaInfoSummary.replace(/"/g, '""') : ''}"`
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

// 데이터를 HTML로 내보내는 기능 추가
function exportHTML() {
  chrome.storage.local.get('websites', function(data) {
    const websites = data.websites || [];
    
    if (websites.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }
    
    // HTML 템플릿 생성
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>웹사이트 벤치마킹 모음</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: 'Malgun Gothic', sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      padding: 20px;
    }
    h1 {
      text-align: center;
      margin-bottom: 20px;
    }
    .websites-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .website-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
    }
    .website-screenshot {
      width: 100%;
      height: 150px;
      object-fit: cover;
      border-bottom: 1px solid #eee;
    }
    .website-info {
      padding: 15px;
    }
    .website-title {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 8px;
    }
    .website-url {
      color: #4285f4;
      font-size: 14px;
      margin-bottom: 8px;
      word-break: break-all;
    }
    .website-category {
      display: inline-block;
      background-color: #f1f1f1;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      margin-bottom: 8px;
    }
    .website-desc {
      font-size: 14px;
      color: #555;
      margin-bottom: 8px;
    }
    .website-notes {
      font-size: 14px;
      font-style: italic;
      color: #666;
    }
    .website-analysis {
      margin-top: 8px;
      padding: 10px;
      background-color: #f5f5f5;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-line;
    }
    .website-media-info {
      margin-top: 8px;
      padding: 4px 8px;
      background-color: #e8f5e9;
      border-radius: 4px;
      font-size: 13px;
      color: #2e7d32;
    }
    .website-date {
      font-size: 12px;
      color: #999;
      text-align: right;
      margin-top: 10px;
    }
    .filter-section {
      margin-bottom: 20px;
      display: flex;
      justify-content: center;
      gap: 15px;
    }
    select, input {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    footer {
      text-align: center;
      margin-top: 30px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>웹사이트 벤치마킹 모음</h1>
    
    <div class="filter-section">
      <select id="category-filter">
        <option value="all">모든 카테고리</option>
        <option value="sns">SNS</option>
        <option value="blog">블로그</option>
        <option value="homepage">홈페이지</option>
        <option value="other">기타</option>
      </select>
      
      <input type="text" id="search-input" placeholder="검색어 입력">
    </div>
    
    <div class="websites-grid" id="websites-container">
      ${websites.map(site => {
        // 포맷된 날짜
        const date = new Date(site.date);
        const formattedDate = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        
        // 카테고리 한글 매핑
        const categoryMap = {
          'sns': 'SNS',
          'blog': '블로그',
          'homepage': '홈페이지',
          'other': '기타'
        };
        
        return `
        <div class="website-card" data-category="${site.category}">
          ${site.screenshot ? `<img src="${site.screenshot}" class="website-screenshot" alt="웹사이트 스크린샷">` : ''}
          <div class="website-info">
            <div class="website-title">${site.title || '(제목 없음)'}</div>
            <a href="${site.url}" class="website-url" target="_blank">${site.url}</a>
            <div class="website-category">${categoryMap[site.category] || site.category}</div>
            ${site.description ? `<div class="website-desc">${site.description}</div>` : ''}
            ${site.notes ? `<div class="website-notes">${site.notes}</div>` : ''}
            
            ${site.mediaInfoSummary ? `<div class="website-media-info">미디어: ${site.mediaInfoSummary}</div>` : ''}
            
            ${site.analysis ? `<div class="website-analysis">${site.analysis.replace(/\n/g, '<br>')}</div>` : ''}
            
            <div class="website-date">${formattedDate}</div>
          </div>
        </div>
        `;
      }).join('')}
    </div>
    
    <footer>
      웹사이트 벤치마킹 저장기로 생성됨
    </footer>
  </div>
  
  <script>
    // 필터링 기능
    document.getElementById('category-filter').addEventListener('change', filterWebsites);
    document.getElementById('search-input').addEventListener('input', filterWebsites);
    
    function filterWebsites() {
      const categoryFilter = document.getElementById('category-filter').value;
      const searchQuery = document.getElementById('search-input').value.toLowerCase();
      const cards = document.querySelectorAll('.website-card');
      
      cards.forEach(card => {
        let show = true;
        
        // 카테고리 필터
        if (categoryFilter !== 'all' && card.dataset.category !== categoryFilter) {
          show = false;
        }
        
        // 검색 필터
        if (searchQuery && show) {
          const cardText = card.textContent.toLowerCase();
          if (!cardText.includes(searchQuery)) {
            show = false;
          }
        }
        
        card.style.display = show ? '' : 'none';
      });
    }
  </script>
</body>
</html>
    `;
    
    // HTML 파일 다운로드
    const blob = new Blob([html], {type: 'text/html;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    
    chrome.downloads.download({
      url: url,
      filename: `웹사이트_벤치마킹_${date}.html`,
      saveAs: true
    });
  });
} 