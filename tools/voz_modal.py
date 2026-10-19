"""La voz del robot en Modal: el guion dicho con una voz clonada, con Qwen3-TTS.

Qwen3-TTS-12Hz-1.7B-Base (Alibaba, licencia Apache-2.0: vale para vídeos monetizados), acelerado con
faster-qwen3-tts (MIT), en una tarjeta L4 de Modal que solo se enciende cuando el robot la llama
(tools/piloto.mjs, `voz.motor: "qwen"` en piloto.json) y se apaga al minuto.

La voz que clona sale de una referencia de unos 10 segundos (referencia.wav) con lo que dice
(referencia.txt), en el volumen privado `jornada90-voz` de Modal. Nunca en el repo, que es público.

Ponerlo (desde el ordenador, con `pip install modal` y `modal setup`):
  modal volume create jornada90-voz
  modal volume put jornada90-voz referencia.wav /referencia.wav
  modal volume put jornada90-voz referencia.txt /referencia.txt
  modal deploy tools/voz_modal.py

Lo que pide: POST {"lines": [{"id": "score", "text": "Remontada del Real Madrid: 4 a 3 a la Roma."}, …]}
con las cabeceras Modal-Key y Modal-Secret (un Proxy Auth Token de Modal). Lo que devuelve:
{"score": {"audio": WAV en base64, "times": null}, …}: el Studio reparte los subtítulos por lo que
dura cada frase.
"""
import base64
import io
import time
from pathlib import Path

import modal

MODELO = 'Qwen/Qwen3-TTS-12Hz-1.7B-Base'
VOZ = Path('/voz')

image = modal.Image.debian_slim(python_version='3.12').pip_install(
    # torchaudio, de la misma versión: si no, pip pone la última, que es para CUDA 13 y no arranca
    'torch==2.8.0', 'torchaudio==2.8.0', 'faster-qwen3-tts==0.5.4',
    # faster-qwen3-tts 0.5.4 no carga con transformers 5.20 («MimiConfig has no attribute rope_theta»)
    'transformers==5.15.1', 'soundfile', 'numpy', 'fastapi[standard]',
)
app = modal.App('jornada90-voz', image=image)
volumen = modal.Volume.from_name('jornada90-voz', create_if_missing=True)


@app.cls(gpu='L4', volumes={str(VOZ): volumen}, timeout=10 * 60, scaledown_window=60)
class Voz:
    @modal.enter()
    def cargar(self):
        import torch
        from faster_qwen3_tts import FasterQwen3TTS
        from huggingface_hub import snapshot_download

        t = time.time()
        # El modelo, en el volumen la primera vez (4 GB); luego, de ahí
        local = VOZ / 'modelos' / MODELO.split('/')[1]
        if not (local / 'model.safetensors').exists():
            snapshot_download(MODELO, local_dir=local)
            volumen.commit()
        self.model = FasterQwen3TTS.from_pretrained(str(local), dtype=torch.bfloat16, local_files_only=True)
        self.ref = str(VOZ / 'referencia.wav')
        self.ref_text = (VOZ / 'referencia.txt').read_text(encoding='utf-8').strip()
        print(f'Modelo cargado en {time.time() - t:.1f} s')

    @modal.fastapi_endpoint(method='POST', requires_proxy_auth=True)
    def decir(self, body: dict):
        return self.frases.local(body.get('lines', []))

    # Lo mismo, para probarlo desde el ordenador con la sesión de Modal (sin el token):
    # modal.Cls.from_name('jornada90-voz', 'Voz')().frases.remote([{'id': …, 'text': …}])
    @modal.method()
    def frases(self, lines: list):
        import numpy as np
        import soundfile as sf
        import torch

        t = time.time()
        out = {}
        for line in lines:
            # La misma semilla en cada frase: el mismo guion suena siempre igual
            torch.manual_seed(1234)
            wavs, sr = self.model.generate_voice_clone(text=line['text'], language='Spanish',
                                                       ref_audio=self.ref, ref_text=self.ref_text)
            buf = io.BytesIO()
            sf.write(buf, np.asarray(wavs[0], dtype=np.float32).squeeze(), sr, format='WAV', subtype='PCM_16')
            out[line['id']] = {'audio': base64.b64encode(buf.getvalue()).decode('ascii'), 'times': None}
        print(f'{len(out)} frases en {time.time() - t:.1f} s')
        return out
