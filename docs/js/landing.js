
document.addEventListener('DOMContentLoaded', async () => {
    // Initial UI Setup
    initLanding();
});

async function initLanding() {
    console.log('TCG Dual Landing Initialized');

    // Fetch stores from Supabase
    const stores = await fetchStores();

    // Map mock data and render slider
    renderStoresSlider(stores);

    // Setup Modal events
    setupModalEvents();
}

async function fetchStores() {
    try {
        const { data, error } = await _supabase
            .from('usuarios')
            .select('id, username, store_name')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error fetching stores:', err);
        return [];
    }
}

// Mock data mapping for stores that don't have these fields in DB
const storeMockData = {
    'toonShop': {
        logo: 'https://placehold.co/200x200/00d2ff/white?text=TS',
        address: 'Av. Principal 123, Ciudad de México',
        hours: 'Lun - Sáb: 10:00 - 20:00'
    },
    'Mexplay': {
        logo: 'https://placehold.co/200x200/3a7bd5/white?text=MP',
        address: 'Calle Falsa 456, Guadalajara',
        hours: 'Lun - Dom: 11:00 - 21:00'
    },
    'miriam': {
        logo: 'https://placehold.co/200x200/ff4757/white?text=M',
        address: 'Plaza Central Local 5, Monterrey',
        hours: 'Mar - Dom: 12:00 - 19:00'
    }
};

function getStoreInfo(store) {
    const mock = storeMockData[store.username] || {
        logo: `https://placehold.co/200x200/333/white?text=${store.store_name[0]}`,
        address: 'Dirección por confirmar',
        hours: 'Consultar por mensaje'
    };

    return {
        name: store.store_name || store.username,
        logo: mock.logo,
        address: mock.address,
        hours: mock.hours,
        link: `public.html?store=${encodeURIComponent(store.store_name || store.username)}`
    };
}

function renderStoresSlider(stores) {
    const wrapper = document.getElementById('stores-slider-wrapper');
    if (!wrapper) return;

    stores.forEach(store => {
        const info = getStoreInfo(store);
        const slide = document.createElement('div');
        slide.className = 'swiper-slide logo-slide';
        slide.innerHTML = `
            <div class="logo-circle">
                <img src="${info.logo}" alt="${info.name}">
            </div>
            <span>${info.name}</span>
        `;

        slide.addEventListener('click', () => {
            showBusinessModal(info);
        });

        wrapper.appendChild(slide);
    });

    // Initialize Swiper
    new Swiper('.logos-swiper', {
        slidesPerView: 2,
        spaceBetween: 30,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        breakpoints: {
            640: { slidesPerView: 3 },
            768: { slidesPerView: 4 },
            1024: { slidesPerView: 5 },
        },
        autoplay: {
            delay: 3000,
            disableOnInteraction: false,
        }
    });
}

function showBusinessModal(info) {
    const modal = document.getElementById('business-modal');
    document.getElementById('modal-business-logo').src = info.logo;
    document.getElementById('modal-business-name').textContent = info.name;
    document.getElementById('modal-business-address').textContent = info.address;
    document.getElementById('modal-business-hours').textContent = info.hours;
    document.getElementById('modal-business-link').href = info.link;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function setupModalEvents() {
    const modal = document.getElementById('business-modal');
    const closeBtn = document.querySelector('.close-business-modal');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}
