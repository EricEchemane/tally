## Ollama
To start ollama now and restart at login:
  brew services start ollama
Or, if you don't want/need a background service you can just run:
  OLLAMA_FLASH_ATTENTION="1" OLLAMA_KV_CACHE_TYPE="q8_0" /opt/homebrew/opt/ollama/bin/ollama serve

---

Your to-do: blur the card numbers, the cardholder name on the Cebu Official Receipt, and the cashier names (optional) in Preview before anything goes into the public repo.

---

➡️ Make it a Company setting, "require buyer details on all receipts / only ₱1,000 and above", and set it to all receipts for the demo Company to match her practice. Then decide between:
- adding one synthetic receipt with Bayanihan Demo Corp's TIN written on it, so the demo shows a ✅
- or letting every sample show the "missing Company TIN" Finding, which demonstrates the rule just as clearly
