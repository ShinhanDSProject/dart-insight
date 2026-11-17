/**
 * '따라 해 보기' 안내를 켜는 주소. 안내 카드(features/booth-guide)가 이 매개변수를 읽고,
 * 첫 화면의 '따라 해 보기' 버튼이 이 주소로 옮긴다(기능끼리 직접 import하지 않으려고 여기에 둔다, DIR-4)
 */
export const BOOTH_GUIDE_PARAM = 'guide'

/** 첫 화면에서 안내를 켜고 시작하는 주소 */
export const BOOTH_GUIDE_START_PATH = `/?${BOOTH_GUIDE_PARAM}`
