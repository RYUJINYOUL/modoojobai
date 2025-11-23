import os
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from PIL import Image
import io
import base64
import re
from datetime import datetime
from pdf2image import convert_from_bytes # PDF 처리 기능 유지

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins=["*"])  # 프로덕션에서는 특정 도메인으로 제한

# Gemini API 설정
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    # 최신 모델 권장
    model = genai.GenerativeModel('gemini-2.5-flash')
    logger.info("✅ Gemini Client Initialized.")
else:
    logger.warning("GEMINI_API_KEY not found in environment variables")

def detect_and_extract_profile_photo(image):
    """
    이미지에서 프로필 사진의 영역을 감지하고, 해당 영역을 Base64로 인코딩하여 반환 (좌표 기반)
    Gemini에게 Base64 인코딩을 맡기지 않고, 좌표만 요청하여 API 지연 시간 및 오류를 줄임.
    """
    try:
        if not GEMINI_API_KEY:
            return None
            
        # 🌟 좌표를 요청하는 새로운 프롬프트
        coord_prompt = """
당신은 전문 이력서 이미지 분석 AI입니다.
**오직 지원자의 얼굴이 포함된 공식적인 증명사진(프로필 사진) 영역만**을 찾아 정규화된 JSON 좌표를 반환하세요.
프로필 사진은 보통 이력서의 **가장 상단, 이름과 연락처 정보 근처의 작은 직사각형 또는 정사각형 영역**에 위치합니다.
**경력, 활동, 포트폴리오 등 다른 섹션에 포함된 이미지(예: 프로젝트 스크린샷, 회사 로고, 기타 사진)는 절대 무시**해야 합니다.

반드시 다음 구조를 따르세요:
{"x_min": "왼쪽 상단 x좌표 (0~1000)", "y_min": "왼쪽 상단 y좌표 (0~1000)", "x_max": "오른쪽 하단 x좌표 (0~1000)", "y_max": "오른쪽 하단 y좌표 (0~1000)"}

좌표는 이미지 전체를 1000x1000 스케일(0부터 1000 사이의 정수)로 반환해야 합니다.
**공식적인 증명사진 영역을 찾지 못했다면** **빈 문자열("")**을 반환하세요. JSON 외의 다른 설명은 일절 포함하지 마세요.
"""
        
        response = model.generate_content([coord_prompt, image])
        json_text = response.text.strip()
        
        # JSON 파싱
        if not json_text.startswith('{'):
            logger.info(f"프로필 사진 추출 실패: 좌표 대신 텍스트 반환 - {json_text[:50]}...")
            return None
            
        coords = json.loads(json_text)
        
        # 좌표 유효성 검사
        if not all(k in coords and isinstance(coords[k], (int, float)) for k in ["x_min", "y_min", "x_max", "y_max"]):
            logger.warning("프로필 사진 추출 실패: 유효하지 않은 좌표 형식")
            return None
        
        # 이미지 크기 가져오기
        width, height = image.size
        
        # 정규화된 좌표를 실제 픽셀 좌표로 변환
        # PIL의 crop은 (left, top, right, bottom) 순서
        x_min = int(coords['x_min'] * width / 1000)
        y_min = int(coords['y_min'] * height / 1000)
        x_max = int(coords['x_max'] * width / 1000)
        y_max = int(coords['y_max'] * height / 1000)
        
        # 유효 범위 확인 및 수정 (10픽셀 이상의 영역이 유효하다고 가정)
        if x_max <= x_min + 10 or y_max <= y_min + 10:
            logger.info("프로필 사진 추출 실패: 너무 작은 영역")
            return None
            
        # 이미지 크롭
        cropped_img = image.crop((x_min, y_min, x_max, y_max))
        
        # Base64 인코딩
        buffered = io.BytesIO()
        # PNG 포맷으로 인코딩하여 투명도 문제를 방지합니다.
        cropped_img.save(buffered, format="PNG") 
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        # Base64 Data URL 형식으로 반환
        result_url = f"data:image/png;base64,{img_str}"
        logger.info("프로필 사진 추출 성공 (좌표 기반)")
        return result_url
            
    except json.JSONDecodeError:
        logger.warning(f"프로필 사진 추출 실패: JSON 디코딩 오류. 응답: {json_text[:50]}...")
    except Exception as e:
        logger.warning(f"프로필 사진 추출 실패: {e}")
    
    return None



def extract_resume_data_from_image(image):
    """이미지에서 포괄적인 이력서 정보를 추출하는 함수"""
    try:
        if not GEMINI_API_KEY:
            logger.error("Gemini API Key가 설정되지 않았습니다.")
            return None

        # specialties 필드 수정 내용이 포함된 프롬프트 유지
        prompt = """
당신은 전문적인 이력서 분석 AI입니다. 이 이미지에서 모든 가능한 정보를 추출해서 정확한 JSON으로 반환해주세요.

다음 구조로 정보를 추출하되, 빈 정보는 빈 문자열이나 빈 배열로 설정하세요:
{
  "name": "이름 (한글/영문 모두 포함)",
  "birthDate": "생년월일 (YYYY/MM/DD 형식으로 변환)",
  "phone": "전화번호 (010-XXXX-XXXX 형식으로 정규화)",
  "email": "이메일 주소",
  "address": "주소 (전체 주소)",
  "selfIntroduction": "자기소개서/자기PR/지원동기/성격/특징 등 모든 텍스트를 종합",
  
  "educations": [
    {
      "school": "학교명",
      "degree": "고등학교/대학(2,3년)/대학(4년)/대학원 중 하나로 분류",
      "subDegree": "석사/박사 (대학원인 경우)",
      "major": "전공/학과",
      "entryYear": "입학년도",
      "graduationYear": "졸업년도",
      "status": "졸업/재학중/휴학중/중퇴/수료 중 하나"
    }
  ],
  
  "careers": [
    {
      "company": "회사명/기관명",
      "position": "직책/직위", 
      "department": "부서명",
      "startDate": "시작일 (YYYY-MM-DD)",
      "endDate": "종료일 (YYYY-MM-DD)",
      "isCurrent": "현재 재직중인지 여부 (boolean)",
      "description": "담당업무/성과/프로젝트 설명"
    }
  ],
  
  "certificates": [
    {
      "name": "자격증명/시험명",
      "issuer": "발행기관/주관기관",
      "date": "취득년도 또는 취득일 (YYYY-MM-DD)",
      "score": "점수/등급/결과"
    }
  ],
  
  "languages": [
    {
      "language": "언어명 (영어/일본어/중국어 등)",
      "level": "초급/중급/고급/원어민/유창 중 하나로 분류",
      "testName": "TOEIC/TOEFL/JLPT/HSK 등 공인시험명",
      "score": "점수",
      "date": "응시일/취득일 (YYYY-MM-DD)"
    }
  ],
  
  "computerSkills": [
    {
      "program": "프로그램명 (워드/엑셀/파워포인트/포토샵 등)",
      "level": "상/중/하 중 하나",
      "description": "사용 수준 설명"
    }
  ],
  
  "specialties": [
    {
      "title": "특기/기술/능력 제목과 내용(수준)을 합친 문장. 예: '문서작성 잘함', '체력이 좋음'",
      "content": "빈 문자열(\"\")로 설정", 
    }
  ],
  
  "workPreferences": {
    "selectedJobs": ["희망직무/직종을 배열로"],
    "workType": ["정규직/계약직/인턴/아르바이트 등을 배열로"],
    "workPeriod": "희망근무기간",
    "workDays": ["평일/주말/요일무관 등을 배열로"],
    "workLocation": {
      "regions": ["희망근무지역을 배열로"],
      "address": "구체적 근무지 주소",
      "canWorkRemote": "재택근무 가능 여부 (boolean)"
    },
    "salary": "희망연봉/시급",
    "startDate": "근무시작 가능일 (YYYY-MM-DD)"
  },
  
  "employmentPreferences": {
    "military": "병역상태 (군필/미필/면제)",
    "disability": "장애여부 (장애/비장애)",
    "veteran": "국가보훈 (대상/비대상)",
    "subsidy": "고용지원금 (대상/비대상)"
  },
  
  "portfolios": [
    {
      "name": "포트폴리오/프로젝트 제목",
      "type": "link/file",
      "url": "URL 주소",
      "description": "프로젝트 설명",
      "skills": ["사용 기술/스킬을 배열로"]
    }
  ],
  
  "awards": [
    {
      "name": "수상명/대회명",
      "issuer": "주최기관",
      "date": "수상일 (YYYY-MM-DD)",
      "description": "수상 내용"
    }
  ],
  
  "activities": [
    {
      "name": "활동명 (동아리/봉사/대외활동 등)",
      "organization": "기관/단체명",
      "position": "역할/직책",
      "startDate": "시작일 (YYYY-MM-DD)",
      "endDate": "종료일 (YYYY-MM-DD)",
      "description": "활동 내용"
    }
  ]
}

주의사항:
1. 모든 날짜는 YYYY-MM-DD 형식으로 통일
2. 전화번호는 010-0000-0000 형식으로 정규화
3. boolean 값은 true/false로 설정
4. 정보가 명확하지 않으면 빈 문자열 ""이나 빈 배열 []로 설정
5. 추측하지 말고 이미지에서 명확히 읽을 수 있는 정보만 추출
6. 한국어와 영어가 혼재된 경우 모두 포함
7. 반드시 유효한 JSON 형식으로 반환
8. **이 위에 정의된 JSON 필드 외에 어떠한 필드도 추가하지 마세요. (No extraneous keys)** <--- 이 규칙을 추가

이미지를 자세히 분석하여 가능한 모든 정보를 추출해주세요.
"""
        
        response = model.generate_content([prompt, image])
        
        if not response.text:
            logger.error("Gemini에서 빈 응답을 받았습니다")
            return None
            
        # JSON 추출 및 정제 (생략)
        json_text = response.text.strip()
        
        # 마크다운 코드 블록 제거
        if json_text.startswith('```json'):
            json_text = json_text[7:]
        elif json_text.startswith('```'):
            json_text = json_text[3:]
        
        if json_text.endswith('```'):
            json_text = json_text[:-3]
            
        json_text = json_text.strip()
        
        # JSON 파싱
        resume_data = json.loads(json_text)
        logger.info(resume_data);
        
        # 데이터 후처리 및 검증
        resume_data = validate_and_clean_data(resume_data)
        
        logger.info("포괄적 이력서 데이터 추출 성공")
        return resume_data
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON 파싱 오류: {e}")
        logger.error(f"응답 텍스트: {response.text}")
        
        # JSON 파싱 실패 시 재시도 (생략)
        try:
            # 기본적인 정보만 추출하는 간단한 프롬프트로 재시도
            simple_prompt = """
이미지에서 기본 정보만 추출해서 간단한 JSON으로 반환해주세요:
{
  "name": "이름",
  "phone": "전화번호",
  "email": "이메일",
  "address": "주소",
  "selfIntroduction": "자기소개"
}
JSON만 반환하세요.
"""
            response = model.generate_content([simple_prompt, image])
            simple_data = json.loads(response.text.strip())
            logger.info("기본 정보 추출 성공 (재시도)")
            return simple_data
        except:
            logger.error("재시도도 실패")
            return None
            
    except Exception as e:
        logger.error(f"이미지 분석 오류: {e}")
        return None

def validate_and_clean_data(data):
    """추출된 데이터 검증 및 정제"""
    try:
        # 전화번호 정규화
        if data.get('phone'):
            phone = re.sub(r'[^\d]', '', data['phone'])
            # 한국 전화번호 형식 (010으로 시작하는 11자리)
            if len(phone) == 11 and phone.startswith('010'):
                data['phone'] = f"{phone[:3]}-{phone[3:7]}-{phone[7:]}"
        
        # 생년월일 정규화
        if data.get('birthDate'):
            birth_str = data['birthDate']
            # 다양한 형식 지원
            for fmt in ['%Y/%m/%d', '%Y-%m-%d', '%Y.%m.%d', '%Y%m%d', '%y/%m/%d']:
                try:
                    dt = datetime.strptime(birth_str, fmt)
                    data['birthDate'] = dt.strftime('%Y/%m/%d')
                    break
                except:
                    continue
        
        # 배열 필드 초기화
        array_fields = ['educations', 'careers', 'certificates', 'languages', 'computerSkills', 'specialties', 'portfolios', 'awards', 'activities']
        for field in array_fields:
            if field not in data or not isinstance(data.get(field), list):
                data[field] = []
        
        # workPreferences 구조 보장
        if 'workPreferences' not in data or not isinstance(data.get('workPreferences'), dict):
            data['workPreferences'] = {}
        
        wp = data['workPreferences']
        if 'selectedJobs' not in wp or not isinstance(wp.get('selectedJobs'), list):
            wp['selectedJobs'] = []
        if 'workLocation' not in wp or not isinstance(wp.get('workLocation'), dict):
            wp['workLocation'] = {'regions': [], 'address': '', 'canWorkRemote': False}
        
        logger.info("데이터 검증 및 정제 완료")
        logger.info(data)
        return data
        
    except Exception as e:
        logger.error(f"데이터 정제 오류: {e}")
        return data

# NOTE: enhance_resume_data 함수는 제거되었습니다. (시간 단축 목적)

def analyze_resume_completeness(resume_data):
    """이력서 완성도를 분석하고 개선 제안을 제공"""
    try:
        analysis = {
            "completeness_score": 0,
            "missing_sections": [],
            "improvement_suggestions": [],
            "strengths": []
        }
        
        total_sections = 10
        completed_sections = 0
        
        # 각 섹션 체크
        if resume_data.get('name') and resume_data.get('phone') and resume_data.get('email'):
            completed_sections += 1
            analysis["strengths"].append("기본 연락처 정보 완비")
        else:
            analysis["missing_sections"].append("기본 연락처 정보")
            
        if resume_data.get('selfIntroduction') and len(resume_data['selfIntroduction']) > 50:
            completed_sections += 1
            analysis["strengths"].append("자기소개 작성 완료")
        else:
            analysis["missing_sections"].append("자기소개서")
            analysis["improvement_suggestions"].append("구체적이고 임팩트 있는 자기소개 작성 권장")
            
        if resume_data.get('educations') and len(resume_data['educations']) > 0:
            completed_sections += 1
            analysis["strengths"].append("학력 정보 등록")
        else:
            analysis["missing_sections"].append("학력 정보")
            
        if resume_data.get('careers') and len(resume_data['careers']) > 0:
            completed_sections += 1
            analysis["strengths"].append("경력 사항 등록")
            if any(career.get('description') and len(career.get('description', '')) > 20 for career in resume_data['careers']):
                analysis["strengths"].append("상세한 업무 내용 기술")
            else:
                analysis["improvement_suggestions"].append("경력별 상세 업무 내용(성과 중심) 추가 권장")
        else:
            analysis["missing_sections"].append("경력 사항")
            
        if resume_data.get('certificates') and len(resume_data['certificates']) > 0:
            completed_sections += 1
            analysis["strengths"].append("자격증 보유")
        else:
            analysis["improvement_suggestions"].append("직무 관련 자격증 취득 고려")
            
        if resume_data.get('languages') and len(resume_data['languages']) > 0:
            completed_sections += 1
            analysis["strengths"].append("외국어 능력 보유")
        else:
            analysis["improvement_suggestions"].append("외국어 능력 향상 및 공인 점수 기록 권장")
            
        if resume_data.get('computerSkills') and len(resume_data['computerSkills']) > 0:
            completed_sections += 1
            analysis["strengths"].append("컴퓨터 활용 능력")
        else:
            analysis["missing_sections"].append("컴퓨터 활용 능력")
            
        if resume_data.get('portfolios') and len(resume_data['portfolios']) > 0:
            completed_sections += 1
            analysis["strengths"].append("포트폴리오 보유")
        else:
            analysis["improvement_suggestions"].append("프로젝트 포트폴리오 구축 권장")
            
        if resume_data.get('workPreferences', {}).get('selectedJobs'):
            completed_sections += 1
            analysis["strengths"].append("명확한 희망 직무")
        else:
            analysis["missing_sections"].append("희망 직무")
            analysis["improvement_suggestions"].append("구체적인 목표 직무 설정 필요")
            
        if resume_data.get('specialties') and len(resume_data['specialties']) > 0:
            completed_sections += 1
            analysis["strengths"].append("특기/기술 사항")
        
        analysis["completeness_score"] = round((completed_sections / total_sections) * 100)
        
        return analysis
        
    except Exception as e:
        logger.error(f"완성도 분석 오류: {e}")
        return {"completeness_score": 0, "error": "분석 실패"}

def _process_resume_extraction():
    """실제 이력서 추출 처리 로직 (라우트에서 공통으로 사용)"""
    logger.info("=== _process_resume_extraction 함수 시작 ===")
    
    try:
# ... (생략: 파일 처리 및 이미지 최적화 로직) ...
        if not GEMINI_API_KEY:
            logger.error("Gemini API key가 설정되지 않았습니다")
            return jsonify({"error": "Gemini API key가 설정되지 않았습니다"}), 500
            
        # 'image' 또는 'file' 필드 모두 지원
        file = request.files.get('image') or request.files.get('file')
        logger.info(f"수신된 파일 필드: {list(request.files.keys())}")
        
        if not file:
            return jsonify({"error": "이력서 파일이 필요합니다", "received_fields": list(request.files.keys())}), 400
            
        if file.filename == '':
            return jsonify({"error": "파일이 선택되지 않았습니다"}), 400
            
        file_extension = os.path.splitext(file.filename)[1].lower()
        logger.info(f"파일 정보: {file.filename}, 확장자: {file_extension}, 크기: {file.content_length if hasattr(file, 'content_length') else 'unknown'}")
        
        # 지원되는 파일 형식 확인 (PDF 추가)
        supported_formats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.pdf']
        if file_extension not in supported_formats:
            return jsonify({"error": f"지원되지 않는 파일 형식입니다. 지원 형식: {', '.join(supported_formats)}"}), 400

        try:
            image_bytes = file.read()
            processed_image = None
            
            if file_extension == '.pdf':
                logger.info("PDF 파일 처리 시작...")
                # 1. 1페이지부터 3페이지까지 모두 이미지로 변환
                images = convert_from_bytes(image_bytes, first_page=1, last_page=3, dpi=72)
                
                if images:
                    # 2. 모든 이미지를 수직으로 이어 붙이기 (Concatenation)
                    
                    # 합칠 이미지들의 높이와 최대 너비 계산
                    widths, heights = zip(*(i.size for i in images))
                    total_height = sum(heights)
                    max_width = max(widths)
                    
                    # 모든 이미지를 담을 빈 이미지 생성
                    processed_image = Image.new('RGB', (max_width, total_height))
                    
                    # 이미지를 순서대로 붙여넣기
                    y_offset = 0
                    for img in images:
                        processed_image.paste(img, (0, y_offset))
                        y_offset += img.size[1]

                    logger.info(f"PDF 다중 페이지 합치기 완료. 최종 크기: {processed_image.size}")
                else:
                    return jsonify({"error": "PDF에서 이미지를 추출할 수 없습니다. 파일이 유효한지 확인해주세요."}), 400
            else:
                # 이미지 파일 처리
                processed_image = Image.open(io.BytesIO(image_bytes))

            # 이미지 크기 최적화 (Gemini API 효율성을 위해)
            max_size = (2048, 2048)
            if processed_image.size[0] > max_size[0] or processed_image.size[1] > max_size[1]:
                processed_image.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # RGBA를 RGB로 변환 (PNG 투명도 처리)
            if processed_image.mode == 'RGBA':
                rgb_image = Image.new('RGB', processed_image.size, (255, 255, 255))
                rgb_image.paste(processed_image, mask=processed_image.split()[-1])
                processed_image = rgb_image
            
            logger.info(f"파일 처리 완료: {processed_image.size}, 모드: {processed_image.mode}")
            
        except Exception as e:
            logger.error(f"파일 처리 오류 (이미지/PDF): {e}")
            return jsonify({"error": f"파일을 처리할 수 없습니다: {str(e)}. poppler-utils가 올바르게 설치되었는지 확인하세요."}), 400

        # 프로필 사진 추출 시도 (새로운 Gemini 기반 로직 사용)
        profile_photo_base64 = detect_and_extract_profile_photo(processed_image)
        
        # 이력서 데이터 추출
        resume_data = extract_resume_data_from_image(processed_image)
        if not resume_data:
            return jsonify({"error": "이력서에서 정보를 추출할 수 없습니다. 이미지가 명확한지 확인해주세요."}), 500
        
        # 프로필 사진이 추출되었다면 추가
        if profile_photo_base64:
            # resume_data['profileImageUrl'] = profile_photo_base64 # 기존 코드는 여기서 data 내부에 넣었음
            resume_data['hasProfilePhoto'] = True
            
            # ⭐️ 수정: profile_photo_base64를 따로 관리하여 최종 응답에 명시적으로 추가
            # photo_url_to_return 변수에 저장
            photo_url_to_return = profile_photo_base64 
        else:
            resume_data['hasProfilePhoto'] = False
            photo_url_to_return = None # 프로필 사진이 없는 경우 null 또는 None
            
        # 이력서 완성도 분석
        completeness_analysis = analyze_resume_completeness(resume_data)
        
        response_data = {
            "success": True,
            "profileImageUrl": photo_url_to_return,
            "data": resume_data,
            "analysis": completeness_analysis,
            "extraction_info": {
                "has_profile_photo": resume_data.get('hasProfilePhoto', False),
                "enhanced": False, # 개선 단계 제거로 False로 고정
                "extracted_sections": len([k for k, v in resume_data.items() if v and k != 'hasProfilePhoto']),
                "file_type": file_extension,
                "image_size": f"{processed_image.size[0]}x{processed_image.size[1]}"
            },
            "message": f"✅ 이력서 정보 추출 완료! 완성도: {completeness_analysis.get('completeness_score', 0)}% (개선 단계 생략)"
        }
        
        logger.info(f"이력서 추출 성공 - 완성도: {completeness_analysis.get('completeness_score', 0)}%")
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"API 오류: {e}")
        return jsonify({"error": f"처리 중 오류가 발생했습니다: {str(e)}"}), 500

# 📌 라우트 정의 (분리됨)

@app.route('/health', methods=['GET'])
def health_check():
    """헬스 체크 엔드포인트"""
    try:
        # Firebase 연결 상태 체크 (Gemini만 체크)
        firebase_status = "connected" if GEMINI_API_KEY else "disconnected"
        gemini_status = "connected" if GEMINI_API_KEY else "disconnected"
        
        return jsonify({
            "status": "healthy",
            "firebase": firebase_status,
            "gemini": gemini_status,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

@app.route('/extract-resume', methods=['POST'])
def extract_resume_api():
    """이미지/PDF에서 포괄적인 이력서 정보를 추출하는 강력한 API"""
    logger.info("=== /extract-resume 엔드포인트 호출됨 ===")
    return _process_resume_extraction()

@app.route('/', methods=['POST'])
def root_extract_resume():
    """루트 경로에서도 동일한 기능 제공"""
    logger.info("=== / (루트) 엔드포인트 호출됨 ===")
    return _process_resume_extraction()

# 📌 디버깅용 추가 엔드포인트

@app.route('/test-post', methods=['POST'])
def test_post():
    """POST 요청 테스트"""
    logger.info("=== /test-post 엔드포인트 호출됨 ===")
    return jsonify({
        "message": "POST 요청 성공!",
        "received_form_data": dict(request.form),
        "received_files": list(request.files.keys()),
        "method": request.method,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/extract-resume-debug', methods=['POST'])
def extract_resume_debug():
    """디버그용 엔드포인트"""
    logger.info("=== /extract-resume-debug 엔드포인트 호출됨 ===")
    try:
        file = request.files.get('image') or request.files.get('file')
        if not file:
            return jsonify({
                "error": "파일이 없습니다",
                "files": list(request.files.keys()),
                "form": dict(request.form)
            })
        
        file_size = len(file.read())
        file.seek(0)  # 파일 포인터 리셋
        
        return jsonify({
            "message": "파일 수신 성공",
            "filename": file.filename,
            "content_type": file.content_type,
            "size": file_size,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": str(e)})

# NOTE: /enhance-text 엔드포인트와 enhance_text 함수는 제거되었습니다. (시간 단축 목적)

@app.route('/analyze-completeness', methods=['POST'])
def analyze_completeness():
    """이력서 완성도 분석 전용 API"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "이력서 데이터가 필요합니다"}), 400
            
        analysis = analyze_resume_completeness(data)
        return jsonify({
            "success": True,
            "analysis": analysis
        })
        
    except Exception as e:
        logger.error(f"완성도 분석 오류: {e}")
        return jsonify({"error": f"분석 중 오류가 발생했습니다: {str(e)}"}), 500

# 에러 핸들러
@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "파일이 너무 큽니다. 10MB 이하의 파일을 사용해주세요."}), 413

@app.errorhandler(415)
def unsupported_media_type(e):
    return jsonify({"error": "지원되지 않는 파일 형식입니다."}), 415

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"내부 서버 오류: {e}")
    return jsonify({"error": "서버 내부 오류가 발생했습니다."}), 500

# ========================================
# 라우트 등록 확인 (모든 라우트 정의 후)
# ========================================
logger.info("="*60)
logger.info("🔥 Flask 애플리케이션 라우트 등록 확인")
logger.info("="*60)
for rule in app.url_map.iter_rules():
    methods = ','.join(sorted(rule.methods - {'HEAD', 'OPTIONS'}))
    logger.info(f"✅ {rule.rule:40s} [{methods:15s}] → {rule.endpoint}")
logger.info("="*60)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    logger.info(f"🚀 강력한 이력서 AI OCR 서비스 시작 - 포트: {port}")
    # Gunicorn 사용을 가정하므로, 여기서는 테스트용으로만 실행
    # 실제 배포 환경에서는 Gunicorn이 이 파일을 호출함
    app.run(host='0.0.0.0', port=port, debug=False)