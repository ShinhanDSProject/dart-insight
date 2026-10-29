FROM python:3.12-slim-bookworm
WORKDIR /lab
ENV PYTHONUNBUFFERED=1 HF_HOME=/models HF_HUB_DISABLE_TELEMETRY=1 TOKENIZERS_PARALLELISM=false OMP_NUM_THREADS=2
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && pip freeze > /lab-dependencies.txt
COPY . .
CMD ["python", "lab.py"]
