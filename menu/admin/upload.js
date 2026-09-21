// Image Management Logic
const storage = firebase.storage();
const database = firebase.database();

// DOM Elements
const itemSelect = document.getElementById('itemSelect');
const imageUpload = document.getElementById('imageUpload');
const fileLabel = document.getElementById('fileLabel');
const filePreview = document.getElementById('filePreview');
const previewImage = document.getElementById('previewImage');
const fileNameDisplay = document.getElementById('fileName');
const fileSizeDisplay = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFile');
const uploadButton = document.getElementById('uploadButton');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const statusBar = document.getElementById('statusBar');
const imageGallery = document.getElementById('imageGallery');
const imageCount = document.getElementById('imageCount');
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const closeModalBtn = document.getElementById('closeModal');

// Fetch menu items from Firebase
const fetchMenuItems = () => {
    const menuRef = database.ref('menu');
    menuRef.once('value', (snapshot) => {
        const items = [];
        snapshot.forEach((childSnapshot) => {
            if (childSnapshot.key === '_categoryOrder') return;
            const item = childSnapshot.val();
            if (!item || !item.name) return;

            items.push({
                name: item.name.replace(/\s+/g, ''),
                displayName: item.name
            });
        });
        
        // Sort items alphabetically
        items.sort((a, b) => a.displayName.localeCompare(b.displayName));
        
        // Populate dropdown
        itemSelect.innerHTML = '<option value="">Select an item</option>';
        items.forEach((item) => {
            const option = document.createElement('option');
            option.value = item.name;
            option.textContent = item.displayName;
            itemSelect.appendChild(option);
        });
    }).catch(err => {
        console.error("Error fetching menu items:", err);
        showToast("Error loading menu items: " + err.message, "error");
    });
};

// Format file size
const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
};

// Resize image function preserving aspect ratio
const resizeImage = (file, maxWidth = 600, maxHeight = 600) => {
    return new Promise((resolve, reject) => {
        const img = document.createElement('img');
        const reader = new FileReader();
        
        reader.onload = (e) => {
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas toBlob failed'));
                }, 'image/jpeg', 0.85);
            };
            img.onerror = () => reject(new Error('Could not load image file'));
        };
        reader.onerror = () => reject(new Error('Could not read image file'));
        reader.readAsDataURL(file);
    });
};

const showStatus = (message, type) => {
    statusBar.innerHTML = message;
    statusBar.className = 'status-bar ' + type;
    statusBar.style.display = 'block';
    setTimeout(() => { statusBar.style.display = 'none'; }, 5000);
};

const displayImages = () => {
    const storageRef = storage.ref('images');
    storageRef.listAll().then((result) => {
        imageGallery.innerHTML = '';
        if (result.items.length === 0) {
            imageGallery.innerHTML = '<div class="empty-gallery" style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--gray);"><i class="fas fa-image fa-3x"></i><p style="margin-top: 10px;">No images found. Upload some!</p></div>';
            imageCount.textContent = '0';
            return;
        }
        imageCount.textContent = result.items.length;
        result.items.forEach((imageRef) => {
            imageRef.getDownloadURL().then((url) => {
                const imageItem = document.createElement('div');
                imageItem.className = 'image-item';
                imageItem.innerHTML = `
                    <div class="image-wrapper">
                        <img src="${url}" alt="${imageRef.name}">
                        <button class="delete-button" data-name="${imageRef.name}"><i class="fas fa-trash"></i></button>
                    </div>
                    <div class="image-info"><div class="image-name">${imageRef.name}</div></div>`;
                
                imageItem.querySelector('img').addEventListener('click', () => {
                    modalImage.src = url;
                    imageModal.style.display = 'flex';
                });
                
                imageItem.querySelector('.delete-button').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete image "${imageRef.name}"?`)) {
                        storage.ref('images/' + imageRef.name).delete().then(() => {
                            imageItem.remove();
                            showToast('Image deleted successfully');
                            const currentCount = Math.max(0, parseInt(imageCount.textContent) - 1);
                            imageCount.textContent = currentCount;
                        }).catch(err => showToast(err.message, 'error'));
                    }
                });
                imageGallery.appendChild(imageItem);
            }).catch(err => {
                console.warn('Could not load image URL for', imageRef.name, err);
            });
        });
    }).catch(err => {
        showStatus(err.message, 'error');
        imageGallery.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--danger);"><i class="fas fa-exclamation-triangle fa-2x"></i><p style="margin-top: 10px;">Could not load gallery: ${err.message}</p></div>`;
    });
};

window.addEventListener('load', () => {
    injectHeader('StaffUpload.html');
    fetchMenuItems();
    displayImages();

    imageUpload.addEventListener('change', () => {
        const file = imageUpload.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                fileNameDisplay.textContent = file.name;
                fileSizeDisplay.textContent = formatFileSize(file.size);
                filePreview.style.display = 'flex';
                fileLabel.innerHTML = '<i class="fas fa-check"></i> Image selected';
                uploadButton.disabled = !itemSelect.value;
            };
            reader.readAsDataURL(file);
        }
    });

    removeFileBtn.addEventListener('click', () => {
        imageUpload.value = '';
        filePreview.style.display = 'none';
        fileLabel.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Choose an image to upload';
        uploadButton.disabled = true;
    });

    itemSelect.addEventListener('change', () => {
        uploadButton.disabled = !(itemSelect.value && imageUpload.files.length > 0);
    });

    uploadButton.addEventListener('click', async () => {
        const file = imageUpload.files[0];
        const itemName = itemSelect.value;
        if (!file || !itemName) return showToast('Please select both item and image', 'warning');
        
        progressContainer.style.display = 'block';
        uploadButton.disabled = true;
        
        try {
            const resizedBlob = await resizeImage(file, 600, 600);
            const newName = `${itemName}.jpg`;
            const uploadTask = storage.ref('images/' + newName).put(resizedBlob, {
                contentType: 'image/jpeg'
            });
            
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    progressBar.style.width = progress + '%';
                    progressText.textContent = progress.toFixed(1) + '%';
                },
                (error) => {
                    showToast(error.message, 'error');
                    progressContainer.style.display = 'none';
                    uploadButton.disabled = false;
                },
                () => {
                    progressContainer.style.display = 'none';
                    showToast('Image uploaded successfully!');
                    imageUpload.value = '';
                    filePreview.style.display = 'none';
                    fileLabel.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Choose an image to upload';
                    uploadButton.disabled = true;
                    displayImages();
                }
            );
        } catch (error) {
            showToast('Failed to process image: ' + error.message, 'error');
            progressContainer.style.display = 'none';
            uploadButton.disabled = false;
        }
    });

    if (closeModalBtn) closeModalBtn.addEventListener('click', () => { imageModal.style.display = 'none'; });
    window.addEventListener('click', (e) => { if (e.target === imageModal) imageModal.style.display = 'none'; });
});
