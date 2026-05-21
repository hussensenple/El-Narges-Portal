import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export const elNargesApi = {
  registerDemoUser: async () => {
    const res = await axios.post(`${API_URL}/users`, {
      name: "عميل الويب 🌐",
      email: `buyer_${Date.now()}@gis.com`,
      password: "123",
      phone: "01000000000",
      role: "user"
    });
    return res.data;
  },

  bookUnit: async (userId: string, arcgisObjectId: number) => {
    const res = await axios.post(`${API_URL}/bookings`, {
      user: userId,
      arcgisObjectId: arcgisObjectId,
      paymentMethod: "Cash",
      notes: "طلب شراء من منصة MERN"
    });
    return res.data;
  }
};