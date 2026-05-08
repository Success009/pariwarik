// Initialize everything on DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Reveal on Scroll
    const reveal = () => {
        const reveals = document.querySelectorAll('.reveal');
        for (let i = 0; i < reveals.length; i++) {
            const windowHeight = window.innerHeight;
            const elementTop = reveals[i].getBoundingClientRect().top;
            const elementVisible = 150;
            if (elementTop < windowHeight - elementVisible) {
                reveals[i].classList.add('active');
            }
        }
    };
    window.addEventListener('scroll', reveal);
    reveal(); // Run once on load

    // 2. Navbar Scroll Effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled', 'shadow-sm');
        } else {
            navbar.classList.remove('scrolled', 'shadow-sm');
        }
    });

    // 3. Smooth Scroll for all links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 5. Scrollspy: Update Active Link on Scroll
    const sections = document.querySelectorAll('section, header, footer');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= sectionTop - 100) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) {
                link.classList.add('active');
            }
        });
    });
});

// 4. Select Room & Pre-fill Booking
function selectRoom(roomName) {
    const bookingSection = document.querySelector('#booking');
    const messageField = document.querySelector('#booking-message');
    
    if (bookingSection) {
        window.scrollTo({
            top: bookingSection.offsetTop - 80,
            behavior: 'smooth'
        });
        
        if (messageField) {
            messageField.value = `I am interested in booking the ${roomName}. Please provide more details.`;
            messageField.focus();
        }
    }
}
