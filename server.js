const express = require('express');
const cors = require('cors');
const { Client } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Раздаем ваш сайт из папки public
app.use(express.static('public'));

// Настройки вашей базы Timeweb PostgreSQL
const client = new Client({
    user: 'gen_user',
    host: 'fc24be87c5567483e18ccc47.twc1.net',
    database: 'default_db',
    password: '3Xwp?UCpJPTn7i', // Рекомендую позже сменить пароль в панели Timeweb
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

client.connect()
    .then(() => console.log('Подключено к PostgreSQL Timeweb!'))
    .catch(err => console.error('Ошибка подключения к БД:', err));

// Получение слотов из базы
app.get('/api/slots', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM slots');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Запись клиента в базу
app.post('/api/book', async (req, res) => {
    const { slot_id, clientName, email, phone } = req.body;
    try {
        await client.query("UPDATE slots SET status = 'booked' WHERE id = $1", [slot_id]);
        await client.query(
            "INSERT INTO bookings (slot_id, clientName, email, phone) VALUES ($1, $2, $3, $4)",
            [slot_id, clientName, email, phone]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер работает на порту ${PORT}`));
