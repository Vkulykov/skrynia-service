Skrynia простий український поштовий 
вебсервіс. монолітний 
вебзастосунок із базовим функціоналом 
електронної пошти та вебінтерфейсом у 
стилі народний модерн.

Технології
Node.js + Express — сервер (моноліт)
EJS — серверний рендеринг сторінок
SQLite (better-sqlite3) — база даних в 
одному файлі
express-session, bcryptjs, multer, 
nodemailer

Швидкий старт
Потрібен Node.js 20 або новіший.

git clone https://github.com/Vkulykov/skrynia-service.git
cd skrynia-service
npm install
npm run seed
npm start

Застосунок буде доступний на http://localhost:3000.
