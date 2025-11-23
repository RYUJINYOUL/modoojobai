# # Google Cloud Functions용 Python 3.11 이미지 사용
# # 문제가 되는 GCR 이미지를 공식 Docker Hub의 python:3.11-slim 이미지로 변경
# FROM python:3.11-slim 

# # 작업 디렉토리 설정
# WORKDIR /app

# # 시스템 패키지 업데이트 및 필요한 패키지 설치
# # slim 이미지에서는 apt-get을 사용하기 전에 update를 반드시 수행해야 합니다.
# RUN apt-get update && apt-get install -y \
#     poppler-utils \
#     && apt-get clean \
#     && rm -rf /var/lib/apt/lists/*

# # Poppler 실행 파일의 경로를 PATH 환경 변수에 명시적으로 추가
# ENV PATH="/usr/bin:${PATH}"

# # Python 의존성 복사 및 설치
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# # Functions Framework 설치 (requirements.txt에 이미 있으므로 주석 처리하거나 제거 가능)
# # 현재 requirements.txt에 functions-framework가 있으므로 이 줄은 중복일 수 있으나, 일단 유지합니다.
# RUN pip install functions-framework

# # 애플리케이션 코드 복사
# COPY . .

# # 포트 설정
# ENV PORT 8080
# EXPOSE 8080

# # Functions Framework로 실행
# CMD exec functions-framework --target=extract_resume --port=$PORT



# Python 3.11 slim 이미지 사용
FROM python:3.11-slim 

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 설치 (OpenCV 및 Poppler 의존성)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-dri \
    libglib2.0-0 \
    poppler-utils \
    libgomp1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Poppler 경로를 PATH에 추가
ENV PATH="/usr/bin:${PATH}"

# Python 의존성 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# 포트 설정
ENV PORT=8080
EXPOSE 8080

# Flask 앱 직접 실행 (Functions Framework 제거)
# 로그 레벨을 info로 설정하고, 접근 로그와 에러 로그를 표준 출력/에러로 설정
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8080", \
     "--workers", "2", \
     "--threads", "4", \
     "--timeout", "120", \
     "--log-level", "info", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--capture-output", \
     "main:app"]