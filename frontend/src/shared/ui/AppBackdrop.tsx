/**
 * 앱 전체 공통 바탕 꾸밈:
 * 천천히 흐르는 점 격자와 한 번 그려지는 두 선(동적 화면 시안).
 * 스크린 리더와 키보드 탐색에서는 숨긴다(aria-hidden="true").
 */
export function AppBackdrop() {
  return (
    <div className="app-backdrop" aria-hidden="true">
      <svg className="app-backdrop__lines" viewBox="0 0 1280 420" preserveAspectRatio="none">
        <path d="M0 330 C140 300 220 340 340 280 S560 200 680 230 S900 120 1040 150 S1200 90 1280 70" />
        <path d="M0 360 C160 350 260 370 380 330 S600 290 720 300 S940 240 1080 250 S1220 220 1280 210" />
      </svg>
    </div>
  )
}
