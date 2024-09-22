FROM --platform=linux/amd64 python:3.12-bookworm AS build

WORKDIR /chatbot
COPY . /chatbot

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 9432

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]