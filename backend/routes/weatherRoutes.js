const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/current', async (req, res) => {
  const { lat, lon } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({ error: "خط الطول والعرض مطلوبين" });
  }

  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    
    const response = await axios.get(url);
    res.json(response.data); // بنبعت الداتا للرياكت
  } catch (error) {
    console.error("Weather API Error:", error.message);
    res.status(500).json({ error: "حدث خطأ أثناء جلب الطقس" });
  }
});

module.exports = router;