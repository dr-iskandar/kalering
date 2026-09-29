# Kalering

POC web app **scan warna dari HP → muncul sebagai texture di viewer LRT 3D pada laptop/big screen**.

- `/viewer` — viewer 3D untuk laptop / TV
- `/scan` — camera upload dari HP
- realtime via Socket.IO
- model FBX: `lrt_new.fbx` + `lrt_gerbong_new.fbx`

Setelah clone:

```bash
npm install
npm run dev
```

Buka `http://localhost:4173/viewer` di laptop. QR di viewer akan menunjuk ke halaman scanner pada IP LAN laptop.

> Untuk demo kamera HP, aplikasi memakai input kamera native (`capture=environment`) sehingga bisa dipakai pada HTTP LAN tanpa membutuhkan WebRTC/getUserMedia.
