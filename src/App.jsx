import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, CheckCircle, XCircle, RefreshCw, ChevronRight, Leaf, Save, PenTool, X, Trash2, Calendar } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';

// --- 파이어베이스 설정 및 초기화 ---
const firebaseConfig = {
  apiKey: "AIzaSyChfRuHFZEN63EvpIjO_9TQ2nQhk0SQlis",
  authDomain: "myhu-e9d57.firebaseapp.com",
  projectId: "myhu-e9d57",
  storageBucket: "myhu-e9d57.firebasestorage.app",
  messagingSenderId: "9843629865",
  appId: "1:9843629865:web:c87e9d68f951732f0da138",
  measurementId: "G-F2NPBS2KPK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 고유 ID 생성 함수
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// --- 문자열 유사도 분석 알고리즘 ---
const editDistance = (s1, s2) => {
  s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
  let costs = new Array();
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1))
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        costs[j - 1] = lastValue; lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
};

const getSimilarity = (s1, s2) => {
  let longer = s1.length < s2.length ? s2 : s1;
  let shorter = s1.length < s2.length ? s1 : s2;
  if (longer.length === 0) return 1.0;
  return (longer.length - editDistance(longer, shorter)) / parseFloat(longer.length);
};

// --- 식물 환경 적응 50문항 데이터 ---
const quizData = [
  { id: 1, question: "일부 식물은 줄기가 단단하다. 왜 그럴까?", keywords: [["바람"]], validAnswers: ["바람이강하게부는환경에적응하기위해서이다", "강한바람에부러지지않으려고"], explanation: "국화나 갈대처럼 거센 바람이 부는 곳에 사는 식물은 꺾이지 않으려 줄기가 단단합니다." },
  { id: 2, question: "어떤 식물들은 잎이 뾰족한 가시 모양으로 변해 있다. 왜 그럴까?", keywords: [["물", "수분", "건조"], ["증발", "손실", "막"]], validAnswers: ["수분증발을막기위해서이다", "건조한곳에서물을유지하려고"], explanation: "사막 등 물이 부족한 환경에서 잎을 통한 수분 증발을 막기 위해 가시로 퇴화했습니다." },
  { id: 3, question: "겨울에 자라는 식물 중에는 잎을 땅바닥에 넓고 납작하게 펼치는 것들이 있다. 왜 그럴까?", keywords: [["바람", "추위", "온기"], ["피하", "막", "유지"]], validAnswers: ["찬바람을피하고땅의온기를받기위해서이다", "추위를이겨내려고"], explanation: "민들레, 냉이 등은 차가운 바람을 피하고 지열로 체온을 유지하기 위해 땅에 납작 엎드립니다." },
  { id: 4, question: "식물의 잎이나 줄기 표면에 빽빽한 잔털이 많이 나 있는 경우가 있다. 왜 그럴까?", keywords: [["추위", "보온", "보호"]], validAnswers: ["추위를막고벌레로부터보호하려고", "보온효과를위해서"], explanation: "잔털은 차가운 기운을 막는 솜옷 역할과 곤충을 물리치는 방어 역할을 합니다." },
  { id: 5, question: "스스로 서지 못하고, 덩굴을 뻗어 다른 물체를 칭칭 감고 올라가는 식물들이 있다. 왜 그럴까?", keywords: [["햇빛", "빛"]], validAnswers: ["햇빛을더잘받기위해서이다", "다른풀들사이에서빛을확보하려고"], explanation: "덩굴식물은 줄기가 약해 다른 것을 타고 올라가야만 광합성에 필요한 빛을 얻을 수 있습니다." },
  { id: 6, question: "바람이 강하게 부는 물가에서 자라는 갈대는 줄기 속을 어떻게 변화시켰을까?", keywords: [["비워", "빈", "비어"]], validAnswers: ["줄기속을비웠다", "속이비어있다"], explanation: "바람을 유연하게 타고 넘어가며 부러지지 않기 위해 줄기 속을 비우는 전략을 택했습니다." },
  { id: 7, question: "강아지풀은 이삭꽃에 보송보송한 잔털이 발달해 있다. 이를 통해 얻는 효과는 무엇일까?", keywords: [["햇살", "빛", "반사"]], validAnswers: ["햇살을반사하거나물방울이맺힌다", "햇빛을강하게반사한다"], explanation: "잔털이 강한 햇빛을 반사하고, 물방울을 맺히게 하여 생존에 유리한 환경을 만듭니다." },
  { id: 8, question: "물이 고인 곳에 떠다니는 개구리밥은 무겁고 긴 뿌리 대신 아주 작은 뿌리만 가지고 있다. 왜 그럴까?", keywords: [["물위", "떠다니", "가볍"]], validAnswers: ["물위에쉽게떠다니기위해서이다", "가볍게물에뜨려고"], explanation: "바닥에 정착하지 않고 물 위를 떠다니기 위해 무거운 뿌리를 퇴화시켰습니다." },
  { id: 9, question: "개망초는 곤충을 유인하기 위해 향기보다 이것을 훨씬 눈에 띄게 발달시켰다. 이것은?", keywords: [["색", "색깔", "꽃잎"]], validAnswers: ["꽃의색깔이다", "화려한색이다"], explanation: "나비 등은 향기보다 색에 더 잘 반응하므로, 향기 대신 꽃의 색을 발달시켰습니다." },
  { id: 10, question: "봄바람이 부는 계절에 피는 꽃다지의 줄기는 유독 부드럽다. 왜 그럴까?", keywords: [["바람", "부러지지", "유연"]], validAnswers: ["바람에부러지지않기위해서이다", "봄바람에유연하게버티려고"], explanation: "뻣뻣하면 부러지기 쉬우므로, 바람에 잘 휘어지도록 부드럽게 적응했습니다." },
  { id: 11, question: "나팔꽃과 같은 덩굴식물은 그늘진 곳에서 싹을 틔워도 결국 밝은 곳으로 갈 수 있다. 무엇을 이용할까?", keywords: [["덩굴", "넝쿨"]], validAnswers: ["덩굴을이용한다", "덩굴을뻗어서이동한다"], explanation: "덩굴을 주변 물체에 감으면서 빛이 있는 위쪽이나 바깥쪽으로 길게 뻗어나갑니다." },
  { id: 12, question: "겨울을 나는 식물들은 잎을 땅에 바짝 붙임으로써 무엇이 잎을 덮어주길 기대하며 보온 효과를 얻을까?", keywords: [["눈", "흰눈"]], validAnswers: ["눈이덮어주기를기대한다", "눈의보온효과"], explanation: "눈이 잎 위를 이불처럼 덮어주면 차가운 겨울 바람으로부터 얼어 죽지 않게 보호받습니다." },
  { id: 13, question: "달맞이꽃처럼 이른 봄의 추위와 바람을 이겨내야 하는 식물은 꽃의 크기를 어떻게 적응시켰을까?", keywords: [["작게", "작다", "줄임"]], validAnswers: ["꽃을작게만들었다", "크기를작게했다"], explanation: "찬 바람에 꽃잎이 상하지 않고 에너지를 아끼기 위해 꽃을 작게 피웁니다." },
  { id: 14, question: "달래는 땅 위로 줄기를 내밀지 못해 햇빛을 못 받아도 계속 번식할 수 있다. 무엇 때문일까?", keywords: [["땅속", "알뿌리", "뿌리"]], validAnswers: ["땅속알뿌리가커지며번식한다", "뿌리를통해번식한다"], explanation: "지상부가 자라기 힘든 환경에서는 땅속에 영양분을 저장한 알뿌리를 통해 살아남고 번식합니다." },
  { id: 15, question: "며느리밑씻개는 잎 뒤쪽에만 날카로운 잔가시가 발달해 있다. 왜 그럴까?", keywords: [["동물", "가시", "보호"]], validAnswers: ["동물들이뜯어먹지못하게하기위해서", "초식동물의접근을막으려고"], explanation: "잎을 노리는 동물들이 쉽게 먹지 못하도록 잎 뒤쪽에 방어용 가시를 세웠습니다." },
  { id: 16, question: "덩굴식물인 바랭이는 가느다란 줄기가 옆으로 뻗어가며 마디마다 이것을 내려 몸을 고정한다. 무엇인가?", keywords: [["실뿌리", "뿌리"]], validAnswers: ["실뿌리를내린다", "작은뿌리를내려공정한다"], explanation: "줄기 마디마다 실뿌리를 흙에 박아 단단히 고정하며 옆으로 넓게 퍼집니다." },
  { id: 17, question: "뱀딸기는 여러 개체가 덩굴로 서로 엮여 자라는 특징이 있다. 왜 이렇게 자랄까?", keywords: [["양분", "나누", "공유"]], validAnswers: ["서로영양분을나눠주기위해서이다", "양분을공유하려고"], explanation: "그늘진 환경에서 생존율을 높이기 위해, 개체들끼리 덩굴으로 연결되어 양분을 나눕니다." },
  { id: 18, question: "쇠무릎은 그늘에서 줄기가 적은 대신 잎을 어떻게 변화시킬까?", keywords: [["가늘", "길게", "세워"]], validAnswers: ["가늘고길게세워자란다", "키를키우려고길게뻗는다"], explanation: "그늘에서는 한정된 에너지를 위로 자라는데 집중하여 빛을 찾기 위해 잎을 뾰족하게 세웁니다." },
  { id: 19, question: "억새와 같이 잎의 가장자리가 날카로운 톱니처럼 날이 서 있는 이유는 무엇일까?", keywords: [["동물", "방어", "공격"]], validAnswers: ["동물이나곤충의공격을막기위해서이다", "자신을보호하려고"], explanation: "가장자리를 날카롭게 만들어 포식자가 잎을 뜯어먹다가 상처를 입게 하여 스스로를 방어합니다." },
  { id: 20, question: "엉겅퀴나 민들레의 씨앗에는 하얀 갓털(솜털)이 달려 있다. 왜 그럴까?", keywords: [["바람", "멀리", "씨앗", "번식"]], validAnswers: ["바람을타고씨앗을멀리퍼트리기위해서", "바람에날아가려고"], explanation: "스스로 이동할 수 없으므로 가벼운 갓털을 이용해 바람을 타고 멀리까지 씨앗을 날려 번식합니다." },
  { id: 21, question: "길가에 사는 질경이의 줄기는 어떤 특징을 가질까?", keywords: [["강하", "질기", "튼튼"]], validAnswers: ["매우강하고질기다", "밟혀도끊어지지않게질기다"], explanation: "밟혀도 줄기와 잎이 끊어지지 않도록 내부에 질긴 섬유질이 매우 강하게 발달했습니다." },
  { id: 22, question: "코스모스처럼 바람에 잘 흔들리는 식물들은 왜 줄기가 가느다랄까?", keywords: [["바람", "면적", "넘어가지"]], validAnswers: ["바람에넘어가지않기위해서이다", "바람맞는면적을줄이려고"], explanation: "잎이 넓으면 바람의 힘을 많이 받아 부러지기 쉬우므로, 바람이 통과하도록 가늘게 적응했습니다." },
  { id: 23, question: "패랭이꽃 줄기에 대나무처럼 무엇이 있기 때문에 바람에 잘 견딜까?", keywords: [["마디"]], validAnswers: ["줄기에마디가있다", "마디가있어서견딘다"], explanation: "대나무처럼 중간중간 마디가 구조를 튼튼하게 잡아주어 키가 커도 잘 꺾이지 않습니다." },
  { id: 24, question: "넓은 잎 구석구석에 양분을 보내기 위해 발달한 잎맥의 모양은?", keywords: [["그물", "그물맥"]], validAnswers: ["그물모양이어야한다", "그물맥이다"], explanation: "넓은 마을에 여러 샛길이 필요하듯, 넓은 잎 구석구석에 물과 양분을 보내기 위해 그물 형태를 띱니다." },
  { id: 25, question: "물살이 거센 곳의 식물은 잎이 왜 실처럼 갈라져 있을까?", keywords: [["물살", "저항", "통과"]], validAnswers: ["센물살이잘빠져나가게하기위해서", "물살의저항을줄이려고"], explanation: "잎이 통짜로 넓으면 물살에 휩쓸려 뽑히므로, 물이 쉽게 통과하도록 갈라진 형태로 적응했습니다." },
  { id: 26, question: "그늘에서 빛을 찾아야 하는 식물은 줄기 높이를 어떻게 적응시킬까?", keywords: [["높", "길", "키우"]], validAnswers: ["높이키운다", "길게뻗는다"], explanation: "주변 풀들 위로 올라가야 햇빛을 받을 수 있으므로 줄기를 최대한 높이 뻗습니다." },
  { id: 27, question: "동물에게 밟히기 쉬운 환경의 식물은 잎자루가 어떠할까?", keywords: [["굵", "두껍", "질기"]], validAnswers: ["훨씬굵다", "두껍고질기다"], explanation: "잎이 쉽게 떨어져 나가지 않도록 잎자루가 굵고 튼튼하게 진화했습니다." },
  { id: 28, question: "햇빛이 잘 드는 곳의 잎이 그늘진 곳보다 색이 짙은 이유는?", keywords: [["햇빛", "양", "광합성"]], validAnswers: ["받는햇빛의양이달라서이다", "빛을많이받어서"], explanation: "햇빛을 충분히 받으면 엽록소가 활발히 생성되어 잎의 색이 훨씬 진하게 변합니다." },
  { id: 29, question: "곤충으로부터 몸을 숨기기 위해 주변 환경과 색을 맞추는 것을 무엇이라 하나요?", keywords: [["보호색", "위장"]], validAnswers: ["보호색을띈다", "위장하기위해서"], explanation: "주변 환경과 비슷한 보호색을 띠어 포식자의 눈에 띄지 않도록 생존율을 높입니다." },
  { id: 30, question: "줄기가 가시로 변해 수분 손실을 막는 대표적인 사막 식물은?", keywords: [["선인장"]], validAnswers: ["선인장이다", "선인장"], explanation: "선인장은 수분 손실을 막기 위해 잎을 가시로 만들었고, 이 가시는 포식자도 막아줍니다." },
  { id: 31, question: "줄기 껍질이 두껍고 거친 식물은 어떤 환경에서 유리할까요?", keywords: [["추위", "보호", "외부"]], validAnswers: ["혹독한추위를견디기위해", "자신을보호하려고"], explanation: "두꺼운 껍질은 갑옷처럼 작용하여 극한의 온도나 수분 증발, 해충으로부터 보호합니다." },
  { id: 32, question: "덩굴식물이 물체를 감기 위해 지닌 용수철 모양의 구조는?", keywords: [["덩굴손"]], validAnswers: ["덩굴손이다", "덩굴손"], explanation: "용수철 모양의 덩굴손은 바람이 불어도 잘 끊어지지 않고 물체를 탄력 있게 감아주는 역할을 합니다." },
  { id: 33, question: "무성한 풀밭에서 잎들이 겹치지 않게 햇빛을 받으려는 배열 방식은?", keywords: [["어긋", "교차", "돌려"]], validAnswers: ["서로어긋나게배열된다", "겹치지않게어긋난다"], explanation: "위쪽 잎이 아래쪽 잎을 가리지 않도록 잎들이 방향을 틀며 어긋나게 자랍니다." },
  { id: 34, question: "향기가 없는 식물은 주로 무엇을 이용해 번식하나요?", keywords: [["바람"]], validAnswers: ["바람을이용한다", "바람에날려보낸다"], explanation: "곤충을 유인하지 못하는 식물들은 갓털이나 날개 모양의 씨앗을 만들어 바람의 힘으로 번식합니다." },
  { id: 35, question: "장미처럼 맛있는 열매를 맺는 식물에 가시가 있는 이유는?", keywords: [["열매", "보호", "동물"]], validAnswers: ["동물들이열매를함부로먹지못하게", "새나동물로부터보호하려고"], explanation: "씨앗이 다 익기도 전에 초식동물이 열매와 잎을 몽땅 먹어버리는 것을 막기 위한 방어막입니다." },
  { id: 36, question: "잎 표면이 왁스 코팅이 된 것처럼 반질반질하면 비가 올 때 어떤 장점이 있나요?", keywords: [["물", "빗물", "흘러"]], validAnswers: ["물이쉽게흘러내린다", "빗물을잘튕겨낸다"], explanation: "잎에 물이 오래 고여 썩거나 곰팡이가 생기는 것을 막기 위해 표면을 코팅 형태로 적응시켰습니다." },
  { id: 37, question: "물에 떠 있는 수련의 숨구멍은 주로 어디에 있나요?", keywords: [["앞면", "윗면", "표면"]], validAnswers: ["잎의앞면에있다", "윗면에몰려있다"], explanation: "물과 닿아있는 뒷면으로는 숨을 쉴 수 없으므로, 공기와 닿는 윗면에 기공이 집중되어 있습니다." },
  { id: 38, question: "바닷가 식물들이 짠물을 마시고도 사는 비결은 무엇인가요?", keywords: [["소금", "배출", "내보"]], validAnswers: ["잎으로소금을배출한다", "염분을밖으로내보낸다"], explanation: "뿌리로 흡수한 소금기를 잎의 표면을 통해 하얗게 밖으로 배출해 내는 특별한 기능이 있습니다." },
  { id: 39, question: "식충식물은 부족한 영양분을 어떻게 보충하나요?", keywords: [["벌레", "곤충", "잡아먹"]], validAnswers: ["벌레를잡아먹는다", "곤충을소화시켜흡수한다"], explanation: "토양에 양분이 부족한 환경에서 살아남기 위해 곤충을 분해하여 양분을 보충합니다." },
  { id: 40, question: "해바라기가 태양을 따라 움직이는 이유는?", keywords: [["햇빛", "양", "광합성"]], validAnswers: ["햇빛을최대한많이받기위해서", "광합성량을늘리려고"], explanation: "생존에 필수적인 햇빛 에너지를 하루 종일 가장 효율적으로 흡수하기 위한 움직임입니다." },
  { id: 41, question: "씨앗에 갈고리가 있는 이유는 무엇일까?", keywords: [["동물", "사람", "이동"]], validAnswers: ["동물의몸에붙어멀리이동하려고", "동물털에붙기위해"], explanation: "동물의 털이나 사람의 옷에 붙어 자신이 갈 수 없는 먼 곳까지 씨앗을 퍼트리려는 전략입니다." },
  { id: 42, question: "고산지대 식물들은 키를 어떻게 키우나요?", keywords: [["작게", "낮게", "바닥"]], validAnswers: ["키를최대한작게한다", "땅에바짝붙어자란다"], explanation: "거센 바람에 꺾이지 않고 지열을 온전히 받기 위해 키가 아주 작게 자랍니다." },
  { id: 43, question: "낙엽수가 겨울에 잎을 버리는 이유는?", keywords: [["물", "수분", "보호"]], validAnswers: ["수분이부족해지기때분이다", "물이얼거나부족해져서"], explanation: "겨울엔 땅이 얼어 물을 흡수할 수 없는데, 잎이 있으면 수분이 계속 증발하므로 잎을 버립니다." },
  { id: 44, question: "소나무 바늘잎이 수분 손실을 막는 원리는?", keywords: [["면적", "좁", "코팅"]], validAnswers: ["표면적을줄여증발을막는다", "단단한코팅이되어있다"], explanation: "바늘잎은 겉면적이 좁고 단단한 코팅이 되어 있어 수분 증발을 효과적으로 막습니다." },
  { id: 45, question: "잡초가 뽑아도 계속 나는 이유는?", keywords: [["뿌리", "땅속"]], validAnswers: ["뿌리가깊고튼튼하기때문이다", "땅속뿌리가남아있어서"], explanation: "지상부가 훼손될 것에 대비해 땅속 깊은 곳에 생명력이 강한 뿌리를 숨겨두기 때문입니다." },
  { id: 46, question: "꽃이 크고 화려한 식물들의 목적은?", keywords: [["곤충", "나비", "벌"]], validAnswers: ["곤충을쉽게유인하기위해서", "꽃가루받이를도와줄곤충을불러서"], explanation: "눈에 띄는 화려함으로 곤충을 끌어들여 번식 성공률을 높이기 위한 적응입니다." },
  { id: 47, question: "이끼는 주로 어떤 곳에서 사나요?", keywords: [["습기", "물기", "그늘"]], validAnswers: ["습기가많고축축한환경", "물기가많은그늘"], explanation: "물을 끌어올릴 뿌리 구조가 없으므로 항상 물기가 있는 곳에 적응했습니다." },
  { id: 48, question: "열대 식물 잎 끝이 뾰족한 이유는?", keywords: [["빗물", "고이지", "배수"]], validAnswers: ["빗물을빨리떨어뜨리기위해서", "물이잎에고이지않게하려고"], explanation: "잎에 물이 고여 썩는 것을 막기 위해 빗물이 끝으로 모여 빨리 떨어지게 합니다." },
  { id: 49, question: "허브의 강한 냄새는 무엇을 위한 것일까?", keywords: [["벌레", "곤충", "방어"]], validAnswers: ["벌레가다가오지못하게막는다", "곤충을쫓는방어역할"], explanation: "포식자가 싫어하는 냄새를 뿜어내어 자신을 보호하는 화학적 방어 수단입니다." },
  { id: 50, question: "양파 알맹이는 식물의 어느 부위인가요?", keywords: [["잎"]], validAnswers: ["잎이겹겹이뭉친것이다", "잎이변형된것"], explanation: "땅속에서 겨울을 나기 위해 잎이 두꺼워져 양분을 저장한 저장용 잎입니다." }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('sheet2');
  const [user, setUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, message: '' });
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [currentReportId, setCurrentReportId] = useState(null);

  // --- 시트 1 상태 ---
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // --- 시트 2 상태 ---
  const initialReportData = {
    grade: '', date: '', teacherFeedback: '',
    environment: { soil: '', wind: '', temp: '', humus: '', organisms: '', sunlight: '' },
    plantA: { image: '', leafColor: '', leafVein: '', leafArrangement: '', leafShape: '', leafSize: '', leafEdge: '', leafTexture: '', stemColor: '', stemForm: '', stemRoughness: '', stemThickness: '', stemLength: '', features: '1. 서식 환경 특징 :\n2. 식물의 적응 형태 :\n3. 알게 된 점 :\n' },
    plantB: { image: '', leafColor: '', leafVein: '', leafArrangement: '', leafShape: '', leafSize: '', leafEdge: '', leafTexture: '', stemColor: '', stemForm: '', stemRoughness: '', stemThickness: '', stemLength: '', features: '1. 서식 환경 특징 :\n2. 식물의 적응 형태 :\n3. 알게 된 점 :\n' },
    commonalities: '1. 잎의 공통점 :\n2. 줄기의 공통점 :\n3. 환경 적응 방식 :\n', differences: '1. 잎의 차이점 :\n2. 줄기의 차이점 :\n3. 환경 적응 방식 :\n'
  };
  const [reportData, setReportData] = useState(initialReportData);

  // --- 그림장 상태 ---
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [drawingTarget, setDrawingTarget] = useState(null);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // --- 관리자 대시보드 상태 ---
  const [allReports, setAllReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [feedbackInput, setFeedbackInput] = useState("");

  // --- Firebase 인증 ---
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth error:", err));
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 사용자 세션 및 데이터 로드
  useEffect(() => {
    const initSession = async () => {
      if (!user) return;
      try {
        const ptrRef = doc(db, 'reports_pointers', user.uid);
        const ptrSnap = await getDoc(ptrRef);

        if (ptrSnap.exists() && ptrSnap.data().currentReportId) {
          const repId = ptrSnap.data().currentReportId;
          setCurrentReportId(repId);
          const repSnap = await getDoc(doc(db, 'reports', repId));
          if (repSnap.exists()) {
            setReportData(repSnap.data());
          }
        } else {
          const newId = generateId();
          setCurrentReportId(newId);
          await setDoc(ptrRef, { currentReportId: newId }, { merge: true });
        }
      } catch (error) {
        console.error("Session init failed:", error);
      }
    };
    initSession();
  }, [user]);

  // 대시보드 데이터 로드
  const fetchAllReports = async () => {
    if (!user) return;
    try {
      const querySnapshot = await getDocs(collection(db, 'reports'));
      const reports = [];
      querySnapshot.forEach((d) => {
        reports.push({ id: d.id, ...d.data() });
      });
      reports.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
      setAllReports(reports);
    } catch (error) {
      console.error("Fetch all failed:", error);
    }
  };

  const saveFeedback = async (reportDocId) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'reports', reportDocId);
      await setDoc(docRef, { teacherFeedback: feedbackInput }, { merge: true });
      setAlertModal({ isOpen: true, message: "피드백이 전송되었습니다." });
      fetchAllReports();
    } catch(e) {
      console.error("Save feedback failed:", e);
    }
  };

  // --- 시트 1 로직 ---
  useEffect(() => {
    const shuffled = [...quizData].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
  }, []);

  const handleQuizSubmit = () => {
    if (!userAnswer.trim()) return;
    const normalize = (str) => str.replace(/\s+/g, '').toLowerCase();
    const input = normalize(userAnswer);
    const currentQ = questions[currentIndex];

    let isCorrect = false;
    if (currentQ.keywords && currentQ.keywords.length > 0) {
      isCorrect = currentQ.keywords.every(group => group.some(kw => input.includes(normalize(kw))));
    }
    if (!isCorrect) {
      for (let ans of currentQ.validAnswers) {
        if (getSimilarity(input, normalize(ans)) >= 0.80) {
          isCorrect = true; break;
        }
      }
    }

    if (isCorrect) {
      setScore(prev => prev + 1);
      setFeedback({ type: 'correct', message: "정답입니다!" });
    } else {
      setFeedback({ type: 'incorrect', message: `오답입니다! 정답(예시): "${currentQ.validAnswers[0]}"` });
    }
  };

  const nextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer("");
      setFeedback(null);
    } else {
      setQuizFinished(true);
    }
  };

  // --- 시트 2 로직 ---
  const handleReportChange = (section, field, value) => {
    setReportData(prev => {
      if (section === 'root') return { ...prev, [field]: value };
      return { ...prev, [section]: { ...prev[section], [field]: value } };
    });
  };

  const saveReport = async () => {
    if (!user || !currentReportId) {
      setAlertModal({ isOpen: true, message: "저장할 수 없습니다. 다시 접속해 주세요." });
      return;
    }
    setIsSaving(true);
    try {
      const docRef = doc(db, 'reports', currentReportId);
      await setDoc(docRef, {
        ...reportData,
        uid: user.uid,
        id: currentReportId,
        savedAt: new Date().toISOString()
      }, { merge: true });
      
      // 저장 후 새 문서를 위해 폼 초기화 및 새 ID 생성
      const newId = generateId();
      setCurrentReportId(newId);
      setReportData(initialReportData);
      try {
        const ptrRef = doc(db, 'reports_pointers', user.uid);
        await setDoc(ptrRef, { currentReportId: newId }, { merge: true });
      } catch (e) {}
      
      await fetchAllReports(); // 대시보드 리스트 갱신
      setActiveTab('dashboard'); // 대시보드로 이동
      setAlertModal({ isOpen: true, message: "보고서가 성공적으로 제출되어 대시보드로 이동했습니다!" });
      setTimeout(() => setIsSaving(false), 500);
    } catch (error) {
      console.error("Save report failed:", error);
      setIsSaving(false);
      setAlertModal({ isOpen: true, message: "저장 중 오류가 발생했습니다." });
    }
  };

  const confirmClear = async () => {
    if (user && currentReportId) {
      try {
        const docRef = doc(db, 'reports', currentReportId);
        await setDoc(docRef, {
          ...reportData,
          uid: user.uid,
          id: currentReportId,
          savedAt: new Date().toISOString()
        }, { merge: true });
        await fetchAllReports();
      } catch (e) {
        console.error("Save before clear failed:", e);
      }
    }

    setReportData(initialReportData);
    setIsClearModalOpen(false);
    const newId = generateId();
    setCurrentReportId(newId);
    if (user) {
      try {
        const ptrRef = doc(db, 'reports_pointers', user.uid);
        await setDoc(ptrRef, { currentReportId: newId }, { merge: true });
        setAlertModal({ isOpen: true, message: "기존 내용은 저장되었으며, 새 문서를 시작합니다." });
      } catch (e) {
        console.error("Clear failed:", e);
      }
    }
  };

  const tempSaveReport = async () => {
    if (!user || !currentReportId) {
      setAlertModal({ isOpen: true, message: "저장할 수 없습니다. 다시 접속해 주세요." });
      return;
    }
    setIsSaving(true);
    try {
      const docRef = doc(db, 'reports', currentReportId);
      await setDoc(docRef, {
        ...reportData,
        uid: user.uid,
        id: currentReportId,
        savedAt: new Date().toISOString()
      }, { merge: true });
      
      await fetchAllReports();
      setAlertModal({ isOpen: true, message: "보고서가 성공적으로 중간 저장되었습니다!" });
      setTimeout(() => setIsSaving(false), 500);
    } catch (error) {
      console.error("Temp save failed:", error);
      setIsSaving(false);
      setAlertModal({ isOpen: true, message: "저장 중 오류가 발생했습니다." });
    }
  };

  // --- 그림장 로직 ---
  const openDrawing = (target) => {
    setDrawingTarget(target);
    setIsDrawingModalOpen(true);
    setTimeout(() => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 300, 400);
        if (reportData[target].image) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0);
          img.src = reportData[target].image;
        }
      }
    }, 50);
  };

  const startDraw = (e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const evt = e.touches ? e.touches[0] : e;
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault(); if (!isDrawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const evt = e.touches ? e.touches[0] : e;
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y); ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.stroke();
  };

  const saveDrawing = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL();
      handleReportChange(drawingTarget, 'image', dataUrl);
      setIsDrawingModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans">
      <nav className="bg-white border-b sticky top-0 z-20 shadow-sm overflow-x-auto">
        <div className="max-w-5xl mx-auto px-4 flex gap-8 whitespace-nowrap">
          <button onClick={() => setActiveTab('sheet1')} className={`py-4 font-bold border-b-4 ${activeTab === 'sheet1' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-400'}`}>반복학습 시트 1</button>
          <button onClick={() => setActiveTab('sheet2')} className={`py-4 font-bold border-b-4 ${activeTab === 'sheet2' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-400'}`}>심화학습 시트 2</button>
          <button onClick={() => { setActiveTab('dashboard'); fetchAllReports(); }} className={`py-4 font-bold border-b-4 ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-400'}`}>대시보드</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 sm:p-8">
        {activeTab === 'sheet1' && (
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-12 border border-gray-200">
            {!quizFinished ? (
              <div className="space-y-8">
                <div className="flex justify-between items-center text-sm font-bold text-gray-500">
                  <span>질문 {currentIndex + 1} / {questions.length}</span>
                  <span className="text-green-600">현재 점수: {score}점</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
                  <div className="bg-green-500 h-full transition-all duration-700" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}></div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black leading-tight text-gray-800">Q. {questions[currentIndex]?.question}</h2>
                <input
                  type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (feedback ? nextQuestion() : handleQuizSubmit())}
                  disabled={feedback !== null} placeholder="생존 비결을 적어보세요..."
                  className="w-full p-6 text-xl border-4 border-gray-100 rounded-2xl focus:border-green-400 outline-none transition-all shadow-md bg-white"
                />
                {!feedback ? (
                  <button onClick={handleQuizSubmit} className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 text-lg">정답 확인하기</button>
                ) : (
                  <div className={`p-8 rounded-3xl border-4 ${feedback.type === 'correct' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex gap-5">
                      {feedback.type === 'correct' ? <CheckCircle className="text-green-600 w-10 h-10 flex-shrink-0"/> : <XCircle className="text-red-600 w-10 h-10 flex-shrink-0"/>}
                      <div>
                        <h4 className={`text-2xl font-black mb-3 ${feedback.type === 'correct' ? 'text-green-800' : 'text-red-800'}`}>{feedback.message}</h4>
                        <p className="text-gray-700 leading-relaxed font-bold text-lg">{questions[currentIndex].explanation}</p>
                      </div>
                    </div>
                    <button onClick={nextQuestion} className="w-full mt-8 bg-gray-800 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-900 shadow-lg">
                      {currentIndex + 1 === questions.length ? "최종 결과 보기" : "다음 문제로 가기"} <ChevronRight/>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-24 bg-green-50 rounded-[3rem] border-8 border-white shadow-2xl">
                <Leaf className="w-24 h-24 text-green-500 mx-auto mb-8 animate-pulse" />
                <h2 className="text-5xl font-black text-green-900 mb-6">탐험 성공!</h2>
                <p className="text-2xl text-green-800 mb-4 font-bold">최종 점수: {score} / {questions.length}</p>
                <p className="text-xl text-green-700 mb-12 font-bold leading-relaxed">50가지의 모든 환경 적응 비결을<br/>완벽하게 마스터했습니다.</p>
                <button onClick={() => window.location.reload()} className="bg-green-600 text-white font-black py-5 px-16 rounded-full text-xl shadow-2xl hover:bg-green-700 transition-all">다시 처음부터 도전</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sheet2' && (
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-green-700 px-8 py-6 flex justify-between items-center text-white flex-wrap gap-4">
              <h2 className="text-3xl font-black flex items-center gap-3"><PenTool size={32}/> 탐구 보고서</h2>
              <div className="flex gap-3">
                <button onClick={() => setIsClearModalOpen(true)} className="bg-white/10 hover:bg-white/20 border border-white/30 px-6 py-3 rounded-xl text-sm font-black flex items-center gap-2"><Trash2 size={20}/> 새로 시작</button>
                <button onClick={tempSaveReport} className="bg-yellow-400 text-yellow-900 px-6 py-3 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-yellow-300 shadow-lg transition-all"><Save size={20}/> {isSaving ? "저장 중..." : "중간 저장"}</button>
                <button onClick={saveReport} className="bg-white text-green-700 px-6 py-3 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-green-50 shadow-lg transition-all"><CheckCircle size={20}/> {isSaving ? "제출 중..." : "제출하고 대시보드로 가기"}</button>
              </div>
            </div>

            <div className="p-6 sm:p-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 bg-gray-50 p-8 rounded-[2rem] border-2 border-gray-100 shadow-inner">
                <div className="space-y-3">
                  <label className="text-sm font-black text-gray-600 ml-1">학년 선택</label>
                  <select value={reportData.grade} onChange={e => handleReportChange('root', 'grade', e.target.value)} className="w-full p-5 border-4 border-white rounded-2xl outline-none font-black bg-white shadow-sm text-lg">
                    <option value="">학년을 고르세요</option><option value="5학년">5학년</option><option value="6학년">6학년</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-black text-gray-600 ml-1 flex items-center gap-1"><Calendar size={16}/> 관찰 날짜</label>
                  <input type="date" value={reportData.date} onChange={e => handleReportChange('root', 'date', e.target.value)} className="w-full p-5 border-4 border-white rounded-2xl outline-none font-black bg-white shadow-sm text-lg" />
                </div>
              </div>

              {reportData.teacherFeedback && (
                <div className="mb-12 p-8 bg-indigo-50 border-l-[12px] border-indigo-500 rounded-[2rem] shadow-md">
                  <h4 className="text-indigo-900 font-black mb-3 flex items-center gap-2 text-xl"><CheckCircle/> 선생님의 피드백</h4>
                  <p className="text-indigo-800 leading-relaxed font-bold whitespace-pre-wrap text-lg">{reportData.teacherFeedback}</p>
                </div>
              )}

              <section className="mb-16">
                <h3 className="text-2xl font-black text-gray-800 mb-8 border-b-8 border-green-400 pb-2 inline-block">1. 환경 요소 관찰 기록</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {['soil', 'wind', 'temp', 'humus', 'organisms', 'sunlight'].map(key => (
                    <div key={key} className="bg-white rounded-2xl overflow-hidden border-4 border-gray-100 shadow-sm">
                      <div className="bg-gray-100 py-3 px-4 text-xs font-black text-gray-500 text-center">
                        {key === 'soil' ? '토양' : key === 'wind' ? '바람' : key === 'temp' ? '온도' : key === 'humus' ? '부엽물' : key === 'organisms' ? '생물' : '햇빛'}
                      </div>
                      <input type="text" value={reportData.environment[key]} onChange={e => handleReportChange('environment', key, e.target.value)} className="w-full p-4 text-center text-lg outline-none focus:bg-green-50 font-bold bg-white" placeholder="입력" />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-2xl font-black text-gray-800 mb-8 border-b-8 border-green-400 pb-2 inline-block">2. 생물 요소 (식물) 관찰 및 비교</h3>
                <div className="overflow-x-auto rounded-[2rem] border-4 border-gray-200 shadow-xl bg-white">
                  <table className="w-full table-fixed min-w-[800px] text-base">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-4 w-[80px] border-r-2 border-b-4 border-gray-200 text-sm">분류 기준</th>
                        <th className="p-4 w-[80px] border-r-2 border-b-4 border-gray-200 text-sm"></th>
                        <th className="p-4 border-r-2 border-b-4 border-gray-200 text-green-700 font-black text-xl italic">식물 (가)</th>
                        <th className="p-4 border-b-4 border-gray-200 text-blue-700 font-black text-xl italic">식물 (나)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* 전체 모습 - 그림장 */}
                      <tr>
                        <td className="p-4 bg-gray-50 font-black text-center border-r-2 text-sm" rowSpan={1}>전체 모습<br/><span className="text-[10px] text-gray-400 font-normal">(클릭하여 그리기)</span></td>
                        <td className="p-4 bg-gray-50 border-r-2"></td>
                        <td onClick={() => openDrawing('plantA')} className="p-0 border-r-2 cursor-pointer hover:bg-green-50">
                          <div className="h-48 w-full flex flex-col items-center justify-center bg-white p-2">
                            {reportData.plantA.image ? <img src={reportData.plantA.image} className="max-h-full object-contain" /> : <><PenTool className="text-gray-200" size={40}/><span className="text-gray-300 text-sm mt-2 font-bold">그림장 열기</span></>}
                          </div>
                        </td>
                        <td onClick={() => openDrawing('plantB')} className="p-0 cursor-pointer hover:bg-blue-50">
                          <div className="h-48 w-full flex flex-col items-center justify-center bg-white p-2">
                            {reportData.plantB.image ? <img src={reportData.plantB.image} className="max-h-full object-contain" /> : <><PenTool className="text-gray-200" size={40}/><span className="text-gray-300 text-sm mt-2 font-bold">그림장 열기</span></>}
                          </div>
                        </td>
                      </tr>
                      {/* 잎 관련 7항목 */}
                      {[
                        ['색상', 'leafColor'],
                        ['잎맥', 'leafVein'],
                        ['잎차례', 'leafArrangement'],
                        ['모양', 'leafShape'],
                        ['크기', 'leafSize'],
                        ['가장자리', 'leafEdge'],
                        ['촉감/털', 'leafTexture'],
                      ].map(([label, field], idx) => (
                        <tr key={field}>
                          {idx === 0 && <td className="p-4 bg-green-50 font-black text-center border-r-2 text-sm align-middle" rowSpan={7}>잎</td>}
                          <td className="p-3 bg-gray-50 text-center border-r-2 text-sm font-bold text-gray-600">{label}</td>
                          <td className="p-0 border-r-2"><input className="w-full p-4 outline-none focus:bg-yellow-50 font-bold text-center bg-white" value={reportData.plantA[field]} onChange={e => handleReportChange('plantA', field, e.target.value)} /></td>
                          <td className="p-0"><input className="w-full p-4 outline-none focus:bg-yellow-50 font-bold text-center bg-white" value={reportData.plantB[field]} onChange={e => handleReportChange('plantB', field, e.target.value)} /></td>
                        </tr>
                      ))}
                      {/* 줄기 관련 5항목 */}
                      {[
                        ['색상', 'stemColor'],
                        ['형태', 'stemForm'],
                        ['거칠기/질김', 'stemRoughness'],
                        ['굵기/두께', 'stemThickness'],
                        ['길이', 'stemLength'],
                      ].map(([label, field], idx) => (
                        <tr key={field}>
                          {idx === 0 && <td className="p-4 bg-blue-50 font-black text-center border-r-2 text-sm align-middle" rowSpan={5}>줄기</td>}
                          <td className="p-3 bg-gray-50 text-center border-r-2 text-sm font-bold text-gray-600">{label}</td>
                          <td className="p-0 border-r-2"><input className="w-full p-4 outline-none focus:bg-yellow-50 font-bold text-center bg-white" value={reportData.plantA[field]} onChange={e => handleReportChange('plantA', field, e.target.value)} /></td>
                          <td className="p-0"><input className="w-full p-4 outline-none focus:bg-yellow-50 font-bold text-center bg-white" value={reportData.plantB[field]} onChange={e => handleReportChange('plantB', field, e.target.value)} /></td>
                        </tr>
                      ))}
                      {/* 종합 특징 */}
                      <tr>
                        <td className="p-4 bg-yellow-50 font-black text-center border-r-2 text-sm align-middle" rowSpan={1}>종합 특징</td>
                        <td className="p-3 bg-gray-50 text-center border-r-2 text-sm font-bold text-gray-600"></td>
                        <td className="p-0 border-r-2"><textarea className="w-full p-4 h-32 outline-none focus:bg-yellow-50 font-bold leading-relaxed resize-none bg-white" placeholder="적응 사례 요약" value={reportData.plantA.features} onChange={e => handleReportChange('plantA', 'features', e.target.value)} /></td>
                        <td className="p-0"><textarea className="w-full p-4 h-32 outline-none focus:bg-yellow-50 font-bold leading-relaxed resize-none bg-white" placeholder="적응 사례 요약" value={reportData.plantB.features} onChange={e => handleReportChange('plantB', 'features', e.target.value)} /></td>
                      </tr>
                      {/* 공통점 */}
                      <tr>
                        <td className="p-4 bg-purple-50 font-black text-center border-r-2 text-sm align-middle" colSpan={2}>공통점</td>
                        <td className="p-0" colSpan={2}><textarea className="w-full p-4 h-24 outline-none focus:bg-yellow-50 font-bold leading-relaxed resize-none bg-white" placeholder="공통점 작성" value={reportData.commonalities} onChange={e => handleReportChange('root', 'commonalities', e.target.value)} /></td>
                      </tr>
                      {/* 차이점 */}
                      <tr>
                        <td className="p-4 bg-orange-50 font-black text-center border-r-2 text-sm align-middle" colSpan={2}>차이점</td>
                        <td className="p-0" colSpan={2}><textarea className="w-full p-4 h-24 outline-none focus:bg-yellow-50 font-bold leading-relaxed resize-none bg-white" placeholder="차이점 작성" value={reportData.differences} onChange={e => handleReportChange('root', 'differences', e.target.value)} /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="bg-white rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row min-h-[750px] border border-gray-200 overflow-hidden">
            <aside className="w-full md:w-80 bg-gray-50 border-r-4 border-gray-100 p-8 overflow-y-auto max-h-[750px]">
              <h2 className="text-2xl font-black mb-8 flex justify-between items-center text-gray-800">누적 목록 <button onClick={fetchAllReports} className="text-indigo-600 hover:rotate-180 transition-all duration-500"><RefreshCw size={24}/></button></h2>
              <div className="space-y-4">
                {allReports.map(r => (
                  <button key={r.id} onClick={() => { setSelectedReport(r); setFeedbackInput(r.teacherFeedback || ""); }} className={`w-full p-6 rounded-[1.5rem] border-4 text-left transition-all ${selectedReport?.id === r.id ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-white border-white hover:border-indigo-200 shadow-sm'}`}>
                    <p className="font-black text-xl">{r.grade || '미입력'}</p>
                    <p className="text-sm opacity-80 font-bold">{r.date || '날짜 없음'}</p>
                    {r.teacherFeedback && <div className="mt-3 text-[10px] bg-green-400 text-white px-3 py-1 rounded-full inline-block font-black">피드백 완료</div>}
                  </button>
                ))}
                {allReports.length === 0 && <p className="text-gray-400 text-center font-bold">저장된 보고서가 없습니다.</p>}
              </div>
            </aside>
            <section className="flex-1 p-8 sm:p-12 overflow-y-auto">
              {selectedReport ? (
                <div className="max-w-3xl mx-auto space-y-12">
                  <header className="bg-indigo-50 p-10 rounded-[3rem] border-4 border-indigo-100 shadow-md">
                    <h3 className="text-3xl font-black text-indigo-900 mb-6 flex items-center gap-3"><PenTool size={32}/> 평가 및 피드백</h3>
                    <textarea value={feedbackInput} onChange={e => setFeedbackInput(e.target.value)} placeholder="학생 보고서에 실시간으로 표시됩니다." className="w-full h-40 p-6 rounded-[2rem] border-4 border-indigo-200 focus:border-indigo-500 outline-none font-bold text-indigo-900 resize-none mb-6 shadow-inner text-lg bg-white" />
                    <button onClick={() => saveFeedback(selectedReport.id)} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg">피드백 전송 및 저장</button>
                  </header>
                  <div className="bg-white p-8 rounded-[2rem] border-4 border-gray-100 shadow-md mb-8">
                    <h4 className="text-2xl font-black text-gray-800 mb-4 border-b-4 border-green-400 pb-2 inline-block">1. 환경 요소</h4>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 p-3 rounded-xl text-center"><strong>토양:</strong><br/>{selectedReport.environment?.soil || "-"}</div>
                      <div className="bg-gray-50 p-3 rounded-xl text-center"><strong>바람:</strong><br/>{selectedReport.environment?.wind || "-"}</div>
                      <div className="bg-gray-50 p-3 rounded-xl text-center"><strong>온도:</strong><br/>{selectedReport.environment?.temp || "-"}</div>
                      <div className="bg-gray-50 p-3 rounded-xl text-center"><strong>부엽물:</strong><br/>{selectedReport.environment?.humus || "-"}</div>
                      <div className="bg-gray-50 p-3 rounded-xl text-center"><strong>생물:</strong><br/>{selectedReport.environment?.organisms || "-"}</div>
                      <div className="bg-gray-50 p-3 rounded-xl text-center"><strong>햇빛:</strong><br/>{selectedReport.environment?.sunlight || "-"}</div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2rem] border-4 border-gray-100 shadow-md mb-8 overflow-x-auto">
                    <h4 className="text-2xl font-black text-gray-800 mb-4 border-b-4 border-green-400 pb-2 inline-block">2. 생물 요소 비교</h4>
                    <table className="w-full text-sm mt-4 text-center border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-3 border-2 border-white">항목</th>
                          <th className="p-3 border-2 border-white text-green-700 text-lg">식물 (가)</th>
                          <th className="p-3 border-2 border-white text-blue-700 text-lg">식물 (나)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-3 bg-gray-50 font-bold border-2 border-white whitespace-nowrap">전체 모습</td>
                          <td className="p-3 border-2 border-gray-50">
                            {selectedReport.plantA?.image ? <img src={selectedReport.plantA.image} className="h-32 mx-auto object-contain bg-white rounded-lg shadow-sm" /> : "-"}
                          </td>
                          <td className="p-3 border-2 border-gray-50">
                            {selectedReport.plantB?.image ? <img src={selectedReport.plantB.image} className="h-32 mx-auto object-contain bg-white rounded-lg shadow-sm" /> : "-"}
                          </td>
                        </tr>
                        {[['잎 색상', 'leafColor'], ['잎맥', 'leafVein'], ['잎차례', 'leafArrangement'], ['잎 모양', 'leafShape'], ['잎 크기', 'leafSize'], ['잎 가장자리', 'leafEdge'], ['잎 촉감/털', 'leafTexture'], ['줄기 색상', 'stemColor'], ['줄기 형태', 'stemForm'], ['줄기 질김', 'stemRoughness'], ['줄기 굵기', 'stemThickness'], ['줄기 길이', 'stemLength'], ['종합 특징', 'features']].map(([label, field]) => (
                          <tr key={field}>
                            <td className="p-3 bg-gray-50 font-bold border-2 border-white whitespace-nowrap">{label}</td>
                            <td className="p-3 border-2 border-gray-50 whitespace-pre-wrap">{selectedReport.plantA?.[field] || "-"}</td>
                            <td className="p-3 border-2 border-gray-50 whitespace-pre-wrap">{selectedReport.plantB?.[field] || "-"}</td>
                          </tr>
                        ))}
                        <tr>
                          <td className="p-3 bg-purple-50 font-bold border-2 border-white whitespace-nowrap">공통점</td>
                          <td colSpan={2} className="p-3 border-2 border-gray-50 whitespace-pre-wrap text-left px-6">{selectedReport.commonalities || "-"}</td>
                        </tr>
                        <tr>
                          <td className="p-3 bg-orange-50 font-bold border-2 border-white whitespace-nowrap">차이점</td>
                          <td colSpan={2} className="p-3 border-2 border-gray-50 whitespace-pre-wrap text-left px-6">{selectedReport.differences || "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 py-32"><BookOpen size={100} className="mb-8 opacity-20"/><p className="text-3xl font-black opacity-30">목록에서 탐구 보고서를 선택하세요</p></div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* 그림장 팝업 */}
      {isDrawingModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gray-800 text-white p-6 flex justify-between items-center">
              <span className="font-black text-xl">관찰 드로잉</span><button onClick={() => setIsDrawingModalOpen(false)} className="hover:bg-gray-700 p-2 rounded-full"><X size={28}/></button>
            </div>
            <div className="p-8 bg-gray-50 flex flex-col items-center">
              <canvas ref={canvasRef} width={300} height={400} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={() => setIsDrawing(false)} className="bg-white shadow-2xl border-4 border-gray-200 cursor-crosshair rounded-[2rem] touch-none mb-8" />
              <div className="flex gap-4 w-full">
                <button onClick={() => { const ctx = canvasRef.current.getContext('2d'); ctx.fillStyle='white'; ctx.fillRect(0,0,300,400); }} className="flex-1 py-5 bg-gray-200 text-gray-700 font-black rounded-2xl text-lg transition-all hover:bg-gray-300">지우기</button>
                <button onClick={saveDrawing} className="flex-1 py-5 bg-green-600 text-white font-black rounded-2xl text-lg shadow-xl hover:bg-green-700 transition-all">완료</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 초기화 확인 모달 */}
      {isClearModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[3rem] max-w-sm w-full text-center shadow-2xl border-t-[12px] border-red-500">
            <h3 className="text-3xl font-black text-red-600 mb-6">새로운 탐험 시작</h3>
            <p className="text-gray-600 mb-10 font-bold leading-relaxed text-lg text-center">기존 보고서는 선생님께 제출되었으며,<br/>완전한 빈 화면에서 새로 쓰시겠습니까?</p>
            <div className="flex gap-4">
              <button onClick={() => setIsClearModalOpen(false)} className="flex-1 py-5 bg-gray-100 text-gray-500 font-black rounded-2xl text-lg">취소</button>
              <button onClick={confirmClear} className="flex-1 py-5 bg-red-600 text-white font-black rounded-2xl text-lg shadow-xl">새로 시작</button>
            </div>
          </div>
        </div>
      )}

      {/* 알림 모달 */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[3rem] max-w-sm w-full text-center shadow-2xl border-t-[12px] border-green-500">
            <p className="text-2xl font-black text-gray-800 mb-10 leading-relaxed">{alertModal.message}</p>
            <button onClick={() => setAlertModal({ isOpen: false, message: '' })} className="w-full py-5 bg-green-600 text-white font-black rounded-2xl text-xl shadow-xl hover:bg-green-700">확인</button>
          </div>
        </div>
      )}
    </div>
  );
}
