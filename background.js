// 확장 프로그램 설치/활성화 시 초기화
chrome.runtime.onInstalled.addListener(function() {
  console.log('웹사이트 벤치마킹 저장기가 설치되었습니다.');
});

// 메시지 처리
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log('Background script received message:', request);
    
    if (request.action === "saveWebsite") {
      // 데이터 저장 처리
      sendResponse({status: "success"});
    }
    
    if (request.action === "exportCSV") {
      // 데이터 페이지로 메시지 전달
      chrome.tabs.create({url: 'data.html'}, function(tab) {
        // 탭이 로드될 때까지 기다린 후 메시지 전송
        setTimeout(function() {
          chrome.tabs.sendMessage(tab.id, {action: "exportCSV"});
        }, 500);
      });
      sendResponse({status: "success"});
    }
    
    if (request.action === "popupReady") {
      console.log("팝업 UI가 준비되었습니다.");
    }
    
    return true;  // 비동기 응답을 위해 true 반환
  }
);

// 확장 프로그램 오류 캐치
chrome.runtime.onError.addListener(function(error) {
  console.error('Extension error:', error);
}); 