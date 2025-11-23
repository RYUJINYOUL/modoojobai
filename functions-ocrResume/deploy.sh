#!/bin/bash

# Cloud Run 배포 스크립트
# 사용법: ./deploy.sh [PROJECT_ID] [REGION]

set -e

# 기본값 설정
PROJECT_ID=${1:-"your-project-id"}
REGION=${2:-"asia-northeast1"}
SERVICE_NAME="resume-ai-service"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Cloud Run 배포 시작..."
echo "프로젝트 ID: ${PROJECT_ID}"
echo "리전: ${REGION}"
echo "서비스 이름: ${SERVICE_NAME}"

# Google Cloud 프로젝트 설정
echo "📋 Google Cloud 프로젝트 설정..."
gcloud config set project ${PROJECT_ID}

# Docker 이미지 빌드
echo "🐳 Docker 이미지 빌드 중..."
docker build -t ${IMAGE_NAME} .

# Container Registry에 푸시
echo "📤 Container Registry에 이미지 푸시 중..."
docker push ${IMAGE_NAME}

# Cloud Run에 배포
echo "☁️ Cloud Run에 배포 중..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=${GEMINI_API_KEY}" \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=80 \
  --max-instances=100 \
  --timeout=300

# 배포된 URL 출력
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")
echo "✅ 배포 완료!"
echo "🌐 서비스 URL: ${SERVICE_URL}"
echo ""
echo "📝 환경변수 설정:"
echo "NEXT_PUBLIC_RESUME_AI_API_URL=${SERVICE_URL}"
echo ""
echo "🔧 테스트 명령어:"
echo "curl ${SERVICE_URL}/health"