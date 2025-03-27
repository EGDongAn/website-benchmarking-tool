// 크롬 확장 프로그램과 페이지 간 통신
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log("Content script received message:", request);
    
    if (request.action === "getPageContent") {
      // 안전한 방식으로 콘텐츠 추출
      try {
        // 인스타그램과 같은 특수 사이트 대응
        const isSpecialSite = window.location.hostname.includes('instagram.com') || 
                             window.location.hostname.includes('threads.net') ||
                             window.location.hostname.includes('facebook.com');
        
        let content = '';
        
        if (isSpecialSite) {
          // 제한된 콘텐츠만 가져오기
          content = document.title + '\n\n';
          
          // 안전하게 텍스트만 추출
          const textNodes = document.createTreeWalker(
            document.body, 
            NodeFilter.SHOW_TEXT, 
            null, 
            false
          );
          
          let node;
          while(node = textNodes.nextNode()) {
            if (node.textContent.trim() !== '') {
              content += node.textContent.trim() + '\n';
            }
          }
        } else {
          // 일반 사이트는 전체 콘텐츠 추출
          content = document.documentElement.innerText || document.body.innerText;
        }
        
        sendResponse({
          content: content
        });
      } catch (error) {
        console.error("Error extracting content:", error);
        sendResponse({
          content: "오류: 콘텐츠를 추출할 수 없습니다. " + error.message
        });
      }
    }
    return true;
  }
);

// 페이지 로드 시 준비 메시지 전송
console.log("Content script loaded on: " + window.location.href);
chrome.runtime.sendMessage({
  action: "contentReady", 
  url: window.location.href
}); 