/**
 * 화면에서 만든 글자를 파일로 내려받게 한다(서버를 거치지 않음). 임시 링크를 눌러 받고 바로 치운다.
 * 순수 함수가 아니라 브라우저 동작이라 단위 테스트 대신 화면에서 확인한다.
 */
export function downloadTextFile(fileName: string, content: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // 클릭으로 내려받기가 시작된 뒤에 주소를 놓는다
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
