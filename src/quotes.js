// Local quotes dataset for instantaneous, reliable response without network errors
const fallbackQuotes = [
  { text: "삶이 있는 한 희망은 있다.", author: "키케로" },
  { text: "자신을 믿어라. 겸손하지만 합리적인 자신감 없이는 성공하거나 행복할 수 없다.", author: "노먼 빈센트 필" },
  { text: "도중에 포기하지 말라. 망설이지 말라. 최후의 성공을 거둘 때까지 밀고 나가라.", author: "데일 카네기" },
  { text: "피할 수 없으면 즐겨라.", author: "로버트 엘리엇" },
  { text: "먼저 핀 꽃은 먼저 진다. 남보다 먼저 공을 세우려고 조급히 서두르지 말라.", author: "채근담" },
  { text: "가장 바쁜 사람이 가장 많은 시간을 가진다.", author: "알렉산드리아" },
  { text: "행복은 습관이다. 그것을 몸에 익혀라.", author: "엘버트 허버드" },
  { text: "성공은 최종적인 것이 아니며, 실패는 치명적인 것이 아니다. 중요한 것은 계속 나아가는 용기다.", author: "윈스턴 처칠" },
  { text: "바람이 불지 않을 때 바람개비를 돌리는 방법은, 앞으로 달려 나가는 것이다.", author: "데일 카네기" },
  { text: "우리는 우리가 매일 반복하는 행동의 결과물이다. 따라서 탁월함은 행동이 아니라 습관이다.", author: "아리스토텔레스" },
  { text: "오늘 걷지 않으면 내일은 뛰어야 한다.", author: "라틴 속담" },
  { text: "가장 어두운 밤도 언젠가는 끝나고 해가 떠오를 것이다.", author: "빅토르 위고" }
];

export async function getRandomQuote() {
  const randomIndex = Math.floor(Math.random() * fallbackQuotes.length);
  return fallbackQuotes[randomIndex];
}
