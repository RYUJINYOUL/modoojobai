/**
 * 전체 주소 문자열에서 광역 지역(Region, 도/시)과 기초 지역(SubRegion, 시/군/구)을 추출합니다.
 * 짧은 주소 형식("서울", "경기")과 공식 명칭("서울특별시", "경기도") 모두 처리합니다.
 * @param {string} fullAddress - 카카오 API 등에서 반환된 전체 주소 문자열 (예: "서울 관악구 신림동 110-5")
 * @returns {{region: string, subRegion: string, regionCode: string}} - 추출된 Region, SubRegion, 그리고 Region Code
 */

import { REGION_CODES } from '@/lib/localcode';

export function parseRegionAndSubRegion(fullAddress) {
    let region = '';
    let subRegion = '';

    // 1. 공식 명칭과 자주 쓰이는 축약형을 포함한 지역 목록
    // 주의: 긴 이름이 앞에 와야 정확한 매칭에 유리합니다. (예: '서울특별시'가 '서울'보다 먼저)
    const regions = [
        "강원특별자치도", "경상북도", "경상남도", "전라북도", "전라남도", "충청북도", "충청남도", "제주특별자치도",
        "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시", 
        "세종특별자치시", "경기도",
        // 축약형 (실제 주소 데이터에서 자주 나타남)
        "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "강원", "경기",
        "충북", "충남", "전북", "전남", "경북", "경남", "제주"
    ];
    
    // 주소의 앞뒤 공백 제거
    const trimmedAddress = fullAddress.trim();

    // 2. 주소에서 Region 추출
    for (const r of regions) {
        if (trimmedAddress.startsWith(r)) {
            region = r;
            break;
        }
    }

    // Region을 찾지 못했다면 빈 값을 반환
    if (!region) {
        return { region: '', subRegion: '', regionCode: '' };
    }

    // 3. Region을 제외한 나머지 주소에서 SubRegion 추출 시도
    const addressWithoutRegion = trimmedAddress.substring(region.length).trim();
    const partsAfterRegion = addressWithoutRegion.split(' ');
    
    if (region === "세종특별자치시" || region === "세종") {
        // 세종시는 광역과 기초가 동일하므로 Region을 SubRegion으로 사용
        subRegion = '세종특별자치시'; 
    } else if (partsAfterRegion.length > 0) {
        const firstPart = partsAfterRegion[0];
        // 첫 번째 부분이 시/군/구로 끝나는지 확인
        if (firstPart.endsWith('시') || firstPart.endsWith('군') || firstPart.endsWith('구')) {
            subRegion = firstPart;
        }
    }

    // 4. Region 값을 짧은 이름으로 변환 (Firestore 필터링 용이성을 위해)
    const regionMap = {
        "서울특별시": "서울",
        "부산광역시": "부산",
        "대구광역시": "대구",
        "인천광역시": "인천",
        "광주광역시": "광주",
        "대전광역시": "대전",
        "울산광역시": "울산",
        "세종특별자치시": "세종",
        "강원특별자치도": "강원",
        "경기도": "경기",
        "충청북도": "충북",
        "충청남도": "충남",
        "전라북도": "전북",
        "전라남도": "전남",
        "경상북도": "경북",
        "경상남도": "경남",
        "제주특별자치도": "제주",
        // 축약형은 그대로 최종 값으로 사용
        "서울": "서울", "부산": "부산", "대구": "대구", "인천": "인천", "광주": "광주", "대전": "대전", "울산": "울산", "세종": "세종", "강원": "강원", "경기": "경기",
        "충북": "충북", "충남": "충남", "전북": "전북", "전남": "전남", "경북": "경북", "경남": "경남", "제주": "제주"
    };

    // 맵에서 변환된 이름을 찾고, 없으면 원본 region 사용 (안전장치)
    const mappedRegion = regionMap[region] || region;
    
    // 5. 지역 코드 찾기 - REGION_CODES에서 찾기
    let regionCode = '';
    
    // subRegion이 있으면 "region subRegion" 형태로 먼저 찾아보기
    if (subRegion && REGION_CODES[`${mappedRegion} ${subRegion}`]) {
        regionCode = REGION_CODES[`${mappedRegion} ${subRegion}`];
    } else if (REGION_CODES[mappedRegion]) {
        // subRegion이 없거나 조합으로 찾지 못하면 region만으로 찾기
        regionCode = REGION_CODES[mappedRegion];
    }
    
    return { region: mappedRegion, subRegion, regionCode };
}