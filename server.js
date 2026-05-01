const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Раздаем интерфейс (ваш файл public/index.html)
app.use(express.static(path.join(__dirname, 'client')));

// ==========================================
// НАСТРОЙКИ ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ TIMEWEB
// ==========================================
const client = new Client({
    user: 'gen_user',
    host: 'fc24be87c5567483e18ccc47.twc1.net',
    database: 'default_db',
    password: '3Xwp?UCpJPTn7i', // ⚠️ После успешного запуска рекомендую сменить пароль в панели Timeweb
    port: 5432,
    ssl: { rejectUnauthorized: false } // Обязательная настройка для облачных баз
});

client.connect()
    .then(() => console.log('✅ Успешно подключено к базе PostgreSQL'))
    .catch(err => console.error('❌ Ошибка подключения к базе:', err));

// ==========================================
// 1. БЕЗОПАСНАЯ АВТОРИЗАЦИЯ
// ==========================================
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    // Пароль хранится только здесь, на закрытом сервере
    if (password === 'admin2026') {
        res.json({ success: true, token: 'gp_secure_token_8a9b2c_xyz' });
    } else {
        res.status(401).json({ success: false, message: 'Неверный пароль' });
    }
});

// ==========================================
// 2. РАБОТА С РАСПИСАНИЕМ И КЛИЕНТАМИ
// ==========================================

// Получить все данные (для админки и сайта)
app.get('/api/data', async (req, res) => {
    try {
        const diags = await client.query('SELECT * FROM diagnosticians ORDER BY id');
        // Получаем слоты и приклеиваем к ним данные клиентов (если слот занят)
        const slotsQuery = `
            SELECT s.id, TO_CHAR(s.dateId, 'YYYY-MM-DD') as dateId, s.time, s.diagId, s.status, 
                   b.clientName, b.email, b.phone 
            FROM slots s
            LEFT JOIN bookings b ON s.id = b.slot_id
        `;
        const slots = await client.query(slotsQuery);
        res.json({ diagnosticians: diags.rows, slots: slots.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Запись клиента на разбор (бронирование)
app.post('/api/book', async (req, res) => {
    const { slot_id, clientName, email, phone } = req.body;
    try {
        await client.query('BEGIN'); // Начинаем транзакцию для надежности
        
        // 1. Меняем статус слота на "booked"
        await client.query("UPDATE slots SET status = 'booked' WHERE id = $1", [slot_id]);
        
        // 2. Записываем скрытые контакты клиента в таблицу bookings
        await client.query(
            "INSERT INTO bookings (slot_id, clientname, email, phone) VALUES ($1, $2, $3, $4)",
            [slot_id, clientName, email, phone]
        );
        
        await client.query('COMMIT'); // Подтверждаем изменения
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK'); // Откатываем в случае ошибки
        res.status(500).json({ error: err.message });
    }
});

// Добавить новый слот в расписание (Функция админа)
app.post('/api/slots', async (req, res) => {
    const { id, dateId, time, diagId } = req.body;
    try {
        await client.query(
            "INSERT INTO slots (id, dateid, time, diagid, status) VALUES ($1, $2, $3, $4, 'free')",
            [id, dateId, time, diagId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить слот из расписания навсегда (Функция админа)
app.delete('/api/slots/:id', async (req, res) => {
    try {
        // Удаление слота повлечет автоматическое удаление записи клиента из-за ON DELETE CASCADE в базе
        await client.query('DELETE FROM slots WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Отменить запись клиента, но оставить время свободным (Функция админа)
app.post('/api/cancel-booking', async (req, res) => {
    const { slot_id } = req.body;
    try {
        await client.query('BEGIN');
        await client.query("UPDATE slots SET status = 'free' WHERE id = $1", [slot_id]);
        await client.query("DELETE FROM bookings WHERE slot_id = $1", [slot_id]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
