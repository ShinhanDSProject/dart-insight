/**
 * 글을 클립보드에 넣는다. Clipboard API를 먼저 쓰고, 없거나 거부되면(http·오래된 브라우저) 숨긴 입력창을 골라
 * execCommand('copy')로 한 번 더 해 본다. 넣었으면 true.
 * 순수 함수가 아니라 브라우저 동작이라 단위 테스트 대신 화면에서 확인한다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 아래 방법으로 한 번 더 해 본다
  }
  return copyWithTextarea(text)
}

function copyWithTextarea(text: string): boolean {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  textarea.remove()
  // 누른 버튼으로 포커스를 돌려 둔다(키보드 사용자)
  active?.focus({ preventScroll: true })
  return copied
}
