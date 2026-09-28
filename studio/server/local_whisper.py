import sys
import json
import os

def transcribe(audio_path):
    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"Audio file not found: {audio_path}"}))
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel
        
        # Use tiny.en for ultra-fast local inference on CPU
        model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
        segments_gen, info = model.transcribe(audio_path, beam_size=5, word_timestamps=True)
        
        segments = []
        all_words = []
        
        for seg in segments_gen:
            seg_words = []
            if hasattr(seg, 'words') and seg.words:
                for w in seg.words:
                    word_obj = {
                        "word": w.word.strip(),
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(w.probability, 3)
                    }
                    seg_words.append(word_obj)
                    all_words.append(word_obj)
            
            segments.append({
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
                "words": seg_words
            })
            
        result = {
            "success": True,
            "engine": "faster-whisper-tiny.en",
            "language": info.language,
            "duration": round(info.duration, 3),
            "word_count": len(all_words),
            "segment_count": len(segments),
            "words": all_words,
            "segments": segments
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e), "success": False}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing audio path"}))
        sys.exit(1)
    transcribe(sys.argv[1])
