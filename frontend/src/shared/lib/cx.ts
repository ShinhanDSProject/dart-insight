/** 클래스 이름을 공백으로 잇는다. false·null·undefined·빈 문자열은 뺀다. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
