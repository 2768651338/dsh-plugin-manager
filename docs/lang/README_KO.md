<!-- 한국어 버전. English: README.md -->
<div align="center">

# dsh-plugin-manager

> **모든 플러그인이 드디어 스스로를 말합니다** — 중국어 이름, 쉬운 설명, 원클릭 켜기/끄기, 그리고 UI 안에서 바로 쓰는 메모 편집을 DeepSeek Harness에 제공합니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Plugin-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![version](https://img.shields.io/badge/version-v0.4.0-success.svg)](https://github.com/2768651338/dsh-plugin-manager/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)

<br>

<img src="../assets/preview.png" alt="플러그인 관리자 탭 — 실제 스크린샷" width="720">

**설정 → 플러그인 → 플러그인 관리자** · 165개 플러그인 카탈로그, 원클릭 전환, 그 자리에서 메모 편집.

<br>

[**English**](../README.md) · [**中文**](README_ZH.md) · [**Español**](README_ES.md) · [**日本語**](README_JA.md) · [**Deutsch**](README_DE.md) · [**Русский**](README_RU.md) · [**Português**](README_PT.md)

</div>

> ⚠️ 이 번역은 영어 버전보다 뒤처질 수 있습니다. 카탈로그 수록 자가 점검용 섹션(호환성 / 빠른 시작 / 설정 / 권한과 데이터 / 문제 해결 / 보안)은 [영어 버전](../README.md)을 기준으로 합니다.

---

> 🆕 **2026-08-14 · v0.3.0** — UI 안에서 메모 편집이 추가되었습니다. 카드의 **메모 편집**을 클릭하면 `catalog.json`을 건드리지 않고 플러그인 이름을 바꾸거나 설명을 다시 쓸 수 있습니다.
>
> 🔧 **v0.2.x** — tsx 소스 실행 시 엔드포인트 404(`./typert` 엄격 등록)와 cordis 주입 접근(`ctx.get` 채널) 문제를 수정했습니다.

---

## 왜 필요한가

| 고통 | 이전에는 | 이 플러그인으로 |
|------|----------|-----------------|
| 플러그인 목록이 무의미 | 영어 모듈 이름뿐이라 각 행이 뭘 하는지 모름 | 모든 플러그인에 중국어 이름 + 한 줄 설명 + 카테고리 |
| 전환이 수작업 | `cordis.patch.yml`을 손으로 편집(망가지기 쉬움) | 원클릭 스위치, 줄 단위 수술 편집, 약 1초 내 핫 리로드 |
| 미등록 플러그인은 여전히 미스터리 | 폴백 문구뿐 | UI 안에서 직접 메모 추가 |
| 실수 클릭에서 안전하지 않음 | 어떤 행이든 비활성화 가능 | 시스템 행 잠금, `!!js` 제어 행 라벨 표시 |

## 설치

```bash
# 방법 1: GitHub에서 설치(권장, dsh-navbar와 동일한 번들 메커니즘)
dsh plugin --profile web add github:2768651338/dsh-plugin-manager#main

# 방법 2: zip으로 설치(Release 페이지에서 다운로드)
# 공백 없는 경로에 압축을 푼 뒤:
dsh plugin --profile web add file:/<압축해제-경로>/dsh-plugin-manager

# 방법 3: 로컬 빌드(이 저장소를 클론)
pnpm build   # tsc + tsdown → lib/index.js(호스트 절반)와 lib/client.js(브라우저 절반)
dsh plugin --profile web add file:./dsh-plugin-manager
```

> 그런 다음 **DeepSeek Harness를 재시작**하고 **Ctrl+F5**를 한 번 누르세요. 설정 → 플러그인 → 플러그인 관리자를 엽니다.
> `lib/` 산출물이 커밋되어 있어 GitHub 설치는 로컬 빌드가 필요 없습니다.

## 기능

| 기능 | 설명 |
|------|------|
| 📚 중국어 카탈로그 | 130개 이상의 내장 항목(이름 / 설명 / 카테고리)과 플러그인별 커스터마이징 |
| 🔘 원클릭 전환 | `~/.dsh/cordis.patch.yml`(전역 레이어)에 기록하면 DSH의 HMR 감시자가 약 1초 내 재적용; 활성화 시 하위 레이어를 덮는 명시적 `disabled: false` 기록 |
| ✏️ UI 메모 편집 | 각 카드의 “메모 편집”으로 중국어 이름/설명 수정(`~/.dsh/plugin-manager/catalog.json`에 저장), 원클릭 기본값 복원 |
| 🛡️ 안전장치 | 부트스트랩/전송/설정 셸 행은 “시스템”으로 잠금; `!!js` 표현식 행은 “표현식 제어”로 표시 |
| 🔍 검색과 필터 | 이름/설명/모듈로 검색, 카테고리 필터, 활성 개수 요약 |

## 동작 원리

| 절반 | 파일 | 역할 |
|------|------|------|
| 호스트 | `lib/index.js` | `pluginManager` cordis 서비스(Typert 원격) 등록: `list` / `setEnabled` / `setOverride` / `removeOverride`. 전환은 패치 파일 수술 편집 — 주석과 `!!js` 표현식 보존, 쓰기 전 재읽기로 동시 편집 병합 |
| 호스트 | `lib/typert.host.js` | `./typert`를 내보내고 typert-loader가 **엄격한 호출 정의**로 등록. 핵심 수정: tsx 소스 실행 시 게이트웨이와 외부 플러그인이 typert-protocol 사본을 각각 가질 수 있고, 데코레이터 마커가 사본 간에 보이지 않음(증상: 모든 호출이 404). 엄격 등록은 공유 레지스트리를 거쳐 모듈 인스턴스 정체성 문제를 우회 |
| 브라우저 | `lib/client.js` | 주입 없는 `ctx.get()` 채널로 `pluginManager` 원격 네임스페이스를 마운트(자체 마운트 교착 방지)하고 `settings.plugins.tab` 슬롯에 탭 등록 |

> 런타임 의존성: `@deepseek-ai/cordis`와 `@deepseek-ai/dsh-typert-protocol`은 DSH의 `profiles/node_modules` 폴백 링크로 해결되며 pnpm 추가 다운로드가 필요 없습니다.

## 커스텀 메모

아무 카드에서 **메모 편집**을 클릭하세요. 두 필드를 모두 비우고 저장하면 해당 플러그인의 커스터마이징이 제거됩니다. 고급 사용자는 `~/.dsh/plugin-manager/catalog.json`을 직접 편집해도 됩니다:

```json
{
  "@dsh-external/dsh-navbar": { "name": "对话导航条", "desc": "对话区右缘的消息节点导航" }
}
```

우선순위: 오버라이드 파일 > 내장 카탈로그 > 영어 짧은 이름.

## 프로젝트 구조

```text
src/
  index.ts              호스트 절반: PluginManagerGateway(list / setEnabled / setOverride / removeOverride)
  patch-file.ts         패치 파일 수술 편집기(순수 함수)
  catalog.ts            내장 카탈로그 + 시스템 보호 집합
  types.ts              공유 데이터 타입
  typert-host.ts        엄격 엔드포인트 등록 산출물(./typert)
  client/
    index.ts            브라우저 절반: 원격 네임스페이스 마운트 + 탭 등록
    remote.ts           클라이언트 원격 산출물(엄격 zod codec)
    PluginManagerTab.tsx 탭 UI(목록 / 전환 / 메모 편집)
    locales.ts          zh/en 사전
cordis.patch.yml        번들 패치(plugin-manager 행 삽입)
lib/                    빌드 산출물(커밋됨; GitHub 설치는 빌드 생략)
tests/                  스모크 / 엔드투엔드 테스트
```

## 테스트

```bash
node tests/patch-file.smoke.mjs   # 패치 편집기 스모크 테스트 9개
node tests/host-gateway.e2e.mjs   # 호스트 게이트웨이 엔드투엔드(오버라이드 파일 내용 포함)
node tests/claims.e2e.mjs         # 일반 node 및 tsx 소스 실행에서의 엔드포인트 등록
```

> 테스트 스크립트 안의 절대 경로는 로컬 DSH 설치를 가리키는 개발 전용이며 런타임 동작에 영향을 주지 않습니다.

## 참고 사항

- 브라우저 측 플러그인(ui-* / client-*) 비활성화는 페이지를 새로고침해야 완전히 반영됩니다;
- 패치 파일을 손으로 편집할 때는 행 블록 구조(열 0의 `- ` 대시)를 유지하세요;
- 제거: `dsh plugin --profile web remove @2768651338/dsh-plugin-manager`.

---

## 스타 히스토리

<a href="https://www.star-history.com/?repos=2768651338%2Fdsh-plugin-manager&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/image?repos=2768651338/dsh-plugin-manager&type=date&legend=top-left" />
  </picture>
</a>

---

<div align="center">

MIT License © [2768651338](https://github.com/2768651338)

DeepSeek Harness의 공개 플러그인 메커니즘 기반 — DeepSeek와 무관합니다.

</div>
