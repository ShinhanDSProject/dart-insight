import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

/** shared 아래 기능을 모르는 공통 폴더와 두 화면 이상이 쓰는 기능 묶음(DIR-2). 새 폴더를 만들면 둘 중 하나에 더한다 */
const SHARED_COMMON = ['api', 'ui', 'hooks', 'lib', 'styles', 'auth']
const SHARED_FEATURES = ['community']
const sharedBoundary = [
  {
    group: ['@/features/*', '@/app/*', '../../*'],
    message: 'shared는 features·app을 import하지 않습니다(DIR-1). shared 안의 다른 폴더는 @/shared/...로 씁니다.',
  },
]

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  // 폴더 경계(conventions.yaml DIR-1~4). 다른 폴더는 '@/...'로, 같은 기능 안은 상대 경로로 import한다.
  {
    files: ['src/features/*/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: featureBoundary('../*') }] },
  },
  {
    files: ['src/features/*/*/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: featureBoundary('../../*') }] },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: sharedBoundary }] },
  },
  // 기능을 모르는 공통 폴더는 shared/<기능> 묶음을 쓰지 않는다(DIR-1·2). 묶음은 공통 폴더를 써도 된다
  {
    files: [`src/shared/{${SHARED_COMMON.join(',')}}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...sharedBoundary,
            {
              // 같은 shared 안의 상대 경로(../community/...)로 돌아가는 것도 막는다
              group: SHARED_FEATURES.flatMap((name) => [`@/shared/${name}`, `@/shared/${name}/*`, `../${name}`, `../${name}/*`]),
              message: '기능을 모르는 shared 폴더는 shared/<기능> 묶음을 import하지 않습니다(DIR-1·2).',
            },
          ],
        },
      ],
    },
  },
])

/** features/<기능> 밖으로 나가는 상대 경로(escape)와 다른 기능·app import를 막는다(DIR-4) */
function featureBoundary(escape) {
  return [
    {
      group: ['@/features/*', '@/app/*'],
      message: '기능끼리 직접 import하지 않습니다(DIR-4). 둘 이상이 쓰면 shared로 올리고, 같은 기능 안은 상대 경로로 씁니다.',
    },
    {
      group: [escape],
      message: '기능 폴더 밖은 상대 경로 대신 @/shared/...로 import합니다(DIR-4).',
    },
  ]
}
