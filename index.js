
import { GoogleGenAI } from "@google/genai";

// --- Constants ---
const CANS = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
const CHIS = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];
const NGU_HANH_MAP = {
    'Giáp': 'Mộc', 'Ất': 'Mộc', 'Bính': 'Hỏa', 'Đinh': 'Hỏa',
    'Mậu': 'Thổ', 'Kỷ': 'Thổ', 'Canh': 'Kim', 'Tân': 'Kim',
    'Nhâm': 'Thủy', 'Quý': 'Thủy'
};
const RELATION = {
    'Kim': { sinh: 'Thủy', khac: 'Mộc' },
    'Mộc': { sinh: 'Hỏa', khac: 'Thổ' },
    'Thủy': { sinh: 'Mộc', khac: 'Hỏa' },
    'Hỏa': { sinh: 'Thổ', khac: 'Kim' },
    'Thổ': { sinh: 'Kim', khac: 'Thủy' }
};
const TAM_HOP = {
    'Tý': ['Thìn', 'Thân'], 'Sửu': ['Tỵ', 'Dậu'], 'Dần': ['Ngọ', 'Tuất'],
    'Mão': ['Mùi', 'Hợi'], 'Thìn': ['Tý', 'Thân'], 'Tỵ': ['Sửu', 'Dậu'],
    'Ngọ': ['Dần', 'Tuất'], 'Mùi': ['Mão', 'Hợi'], 'Thân': ['Tý', 'Thìn'],
    'Dậu': ['Sửu', 'Tỵ'], 'Tuất': ['Dần', 'Ngọ'], 'Hợi': ['Mão', 'Mùi']
};
const LUC_HOP = {
    'Tý': 'Sửu', 'Sửu': 'Tý', 'Dần': 'Hợi', 'Hợi': 'Dần', 'Mão': 'Tuất',
    'Tuất': 'Mão', 'Thìn': 'Dậu', 'Dậu': 'Thìn', 'Tỵ': 'Thân', 'Thân': 'Tỵ',
    'Ngọ': 'Mùi', 'Mùi': 'Ngọ'
};
const XUNG = {
    'Tý': 'Ngọ', 'Ngọ': 'Tý', 'Mão': 'Dậu', 'Dậu': 'Mão', 'Thìn': 'Tuất',
    'Tuất': 'Thìn', 'Sửu': 'Mùi', 'Mùi': 'Sửu', 'Dần': 'Thân', 'Thân': 'Dần',
    'Tỵ': 'Hợi', 'Hợi': 'Tỵ'
};

// --- Helper Functions ---
const getCanChi = (year) => {
    const y = parseInt(year);
    if (isNaN(y)) return { name: '?', element: '?' };
    const can = CANS[y % 10];
    const chi = CHIS[y % 12];
    return {
        year: y,
        can,
        chi,
        name: `${can} ${chi}`,
        element: NGU_HANH_MAP[can]
    };
};

// --- Core Calculation ---
const findBestMatches = (hostYear, targetYear) => {
    const host = getCanChi(hostYear);
    const target = getCanChi(targetYear);
    const matches = [];

    // Scan years 1950 - 2015 to find suitable xông đất guests
    for (let y = 1950; y <= 2015; y++) {
        if (y === hostYear) continue;
        const guest = getCanChi(y);
        let score = 0;
        const reasons = [];

        // 1. Địa Chi Logic
        if (TAM_HOP[host.chi].includes(guest.chi)) { score += 5; reasons.push(`Tam hợp với chủ nhà (${guest.chi})`); }
        if (LUC_HOP[host.chi] === guest.chi) { score += 4; reasons.push(`Lục hợp với chủ nhà`); }
        
        // 2. Ngũ Hành Logic
        if (RELATION[guest.element].sinh === host.element) { score += 4; reasons.push(`Tương sinh (${guest.element} sinh ${host.element})`); }
        if (guest.element === host.element) { score += 2; reasons.push(`Bình hòa bản mệnh`); }
        
        // 3. Target Year Logic
        if (TAM_HOP[target.chi].includes(guest.chi)) { score += 2; reasons.push(`Hợp với năm ${targetYear}`); }

        // Penalties
        if (XUNG[host.chi] === guest.chi) score -= 8;
        if (RELATION[guest.element].khac === host.element) score -= 5;

        if (score > 3) {
            matches.push({ ...guest, score, reasons });
        }
    }
    return matches.sort((a, b) => b.score - a.score).slice(0, 5);
};

// --- AI Service ---
const getAIExplanation = async (host, target, topGuest) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Bạn là chuyên gia phong thủy. Hãy giải thích ngắn gọn (khoảng 150 chữ) tại sao người sinh năm ${topGuest.year} (${topGuest.name}, mệnh ${topGuest.element}) là người xông đất cực tốt cho gia chủ sinh năm ${host.year} (${host.name}) trong năm ${target.year} (${target.name}). Hãy dùng văn phong Tết Việt Nam, ấm áp và tích cực.`;
    
    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
        });
        return result.text;
    } catch (err) {
        return "Hiện tại tôi không thể kết nối với chuyên gia AI, nhưng dựa trên thuật số, người này rất hợp với bạn!";
    }
};

// --- UI Interaction ---
const hostInput = document.getElementById('hostYear');
const targetInput = document.getElementById('targetYear');
const hostInfo = document.getElementById('hostInfo');
const targetInfo = document.getElementById('targetInfo');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('resultsContainer');
const resultsList = document.getElementById('resultsList');
const aiSection = document.getElementById('aiSection');
const aiContent = document.getElementById('aiContent');

const updatePreview = () => {
    const h = getCanChi(hostInput.value);
    const t = getCanChi(targetInput.value);
    hostInfo.innerText = h.name ? `${h.name} • ${h.element}` : '';
    targetInfo.innerText = t.name ? `${t.name} • ${t.element}` : '';
};

const runSearch = async () => {
    const hY = parseInt(hostInput.value);
    const tY = parseInt(targetInput.value);
    if (!hY || !tY) return;

    // Loading State
    searchBtn.disabled = true;
    document.getElementById('btnText').innerText = "ĐANG TRA CỨU...";
    resultsContainer.classList.add('hidden');

    const matches = findBestMatches(hY, tY);
    
    // Build Cards
    resultsList.innerHTML = matches.map((m, idx) => `
        <div class="bg-white p-8 rounded-3xl border-2 transition-all animate-fade-up ${idx === 0 ? 'border-red-500 bg-red-50/30' : 'border-slate-50'}" style="animation-delay: ${idx * 0.1}s">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <span class="text-[10px] font-black tracking-widest bg-red-600 text-white px-3 py-1 rounded-full uppercase">
                        ${idx === 0 ? 'Hợp Nhất' : 'Gợi Ý ' + (idx + 1)}
                    </span>
                    <h3 class="text-3xl font-bold mt-4 text-slate-800">${m.year}</h3>
                    <p class="text-red-600 font-bold text-lg">${m.name}</p>
                </div>
                <div class="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 text-center">
                    <div class="text-2xl font-black text-slate-900">${m.score}</div>
                    <div class="text-[9px] font-bold text-slate-400 uppercase">Điểm Hợp</div>
                </div>
            </div>
            <div class="space-y-4">
                <div class="text-sm font-semibold text-slate-600">Mệnh: <span class="text-red-700">${m.element}</span></div>
                <div class="space-y-2">
                    ${m.reasons.map(r => `<div class="text-sm text-slate-500 flex items-center gap-2"><span>🏮</span> ${r}</div>`).join('')}
                </div>
            </div>
        </div>
    `).join('');

    resultsContainer.classList.remove('hidden');

    // AI Analysis
    if (matches.length > 0) {
        aiSection.classList.remove('hidden');
        aiContent.innerText = "Đang xin ý kiến từ chuyên gia phong thủy AI...";
        const explanation = await getAIExplanation(getCanChi(hY), getCanChi(tY), matches[0]);
        aiContent.innerText = explanation;
    }

    // Reset Button
    searchBtn.disabled = false;
    document.getElementById('btnText').innerText = "XEM NGAY KẾT QUẢ";
};

// --- Initialization ---
hostInput.addEventListener('input', updatePreview);
targetInput.addEventListener('input', updatePreview);
searchBtn.addEventListener('click', runSearch);

// Start
updatePreview();
