/** 채팅 입력창 id. 'A' 단축키와 요약 핵심 카드의 'AI에게 묻기'가 초점을 옮긴다 */
export const CHAT_INPUT_ID = 'chat-input'

/** 열린 채팅 패널의 입력창에 초점을 둔다. 패널이 닫혀 있으면 아무것도 하지 않는다 */
export function focusChatInput(): void {
  document.getElementById(CHAT_INPUT_ID)?.focus()
}
