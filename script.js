// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, onSnapshot, updateDoc, deleteDoc, orderBy, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { v4 as uuidv4 } from "https://jspm.dev/uuid"; // Using jspm.dev for reliable ES Module import of uuid v4

// --- START: Firebase Configuration (YOUR PROJECT DETAILS) ---
// IMPORTANT: Replace these with your actual Firebase project details obtained from Firebase Console
// This configuration is PUBLICLY visible in the HTML source, but does not contain secrets.
const firebaseConfig = {
    apiKey: "AIzaSyBWwGqmrqgVSigyMYl9dBN7t98ogrQkodw",
    authDomain: "mobile-doctor-repair-status.firebaseapp.com",
    projectId: "mobile-doctor-repair-status",
    storageBucket: "mobile-doctor-repair-status.firebaseapp.com",
    messagingSenderId: "821691328695",
    appId: "1:821691328695:web:0832b9a45f114525b28532"
};
const APP_ID = "1:821691328695:web:0832b9a45f114525b28532"; // Your specific appId from firebaseConfig
// --- END: Firebase Configuration ---

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Global state variables
let currentUserId = null;
let isAdminUser = false; // Flag to track admin status
let unsubscribeAdminRepairs = null; // To store the unsubscribe function for real-time listener
let currentAdminRepairsData = []; // To store the current list of repairs for search/sort
let editingRepairId = null; // Store the ID of the repair being edited

// --- DOM Element References ---
const loadingSpinner = document.getElementById('loading-spinner');
const loadingMessage = document.getElementById('loading-message');
const customMessageBox = document.getElementById('customMessageBox');
const messageBoxContent = document.getElementById('messageBoxContent');
const messageBoxCloseButton = document.getElementById('messageBoxCloseButton');

// Customer View Elements
const repairIdInput = document.getElementById('repairIdInput');
const checkStatusButton = document.getElementById('checkStatusButton');
const repairStatusDisplay = document.getElementById('repairStatusDisplay');
const displayDeviceName = document.getElementById('displayDeviceName');
const displayModelNumberContainer = document.getElementById('displayModelNumberContainer');
const displayModelNumber = document.getElementById('displayModelNumber');
const displayCustomerNameContainer = document.getElementById('displayCustomerNameContainer');
const displayCustomerName = document.getElementById('displayCustomerName');
const displayPhoneNumberContainer = document.getElementById('displayPhoneNumberContainer');
const displayPhoneNumber = document.getElementById('displayPhoneNumber');
const displayStatus = document.getElementById('displayStatus');
const displayLastUpdated = document.getElementById('displayLastUpdated');
const displayNotesContainer = document.getElementById('displayNotesContainer');
const displayNotes = document.getElementById('displayNotes');
const printRepairButton = document.getElementById('printRepairButton');

// Admin Login Elements
const adminLoginButton = document.getElementById('adminLoginButton');
const adminEmailInput = document.getElementById('adminEmailInput');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const adminLoginSection = document.getElementById('admin-login');

// Admin Dashboard Elements
const adminDashboard = document.getElementById('admin-dashboard');
const adminLogoutButton = document.getElementById('adminLogoutButton');
const newRepairId = document.getElementById('newRepairId');
const generateRepairIdButton = document.getElementById('generateRepairIdButton');
const newDeviceName = document.getElementById('newDeviceName');
const newModelNumber = document.getElementById('newModelNumber');
const newCustomerName = document.getElementById('newCustomerName');
const newPhoneNumber = document.getElementById('newPhoneNumber');
const newStatus = document.getElementById('newStatus');
const newNotes = document.getElementById('newNotes');
const addRepairButton = document.getElementById('addRepairButton');
const newRepairCodeView = document.getElementById('newRepairCodeView');
const repairsList = document.getElementById('repairsList');
const adminSearchInput = document.getElementById('adminSearchInput');
const adminFilterStatus = document.getElementById('adminFilterStatus');
const adminSortBy = document.getElementById('adminSortBy');

// Edit Modal Elements
const editRepairModal = document.getElementById('editRepairModal');
const editModalTitle = document.getElementById('editModalTitle');
const editDeviceName = document.getElementById('editDeviceName');
const editModelNumber = document.getElementById('editModelNumber');
const editCustomerName = document.getElementById('editCustomerName');
const editPhoneNumber = document.getElementById('editPhoneNumber');
const editStatus = document.getElementById('editStatus');
const editNotes = document.getElementById('editNotes');
const cancelEditButton = document.getElementById('cancelEditButton');
const saveEditButton = document.getElementById('saveEditButton');
const editRepairCodeView = document.getElementById('editRepairCodeView');


// --- Utility Functions ---

/**
 * Displays a loading spinner and message.
 * @param {string} message - The message to display.
 */
function showLoading(message = "Loading...") {
    loadingMessage.textContent = message;
    loadingSpinner.classList.remove('hidden');
    // Add opacity transition for smoother appearance
    setTimeout(() => loadingSpinner.style.opacity = '1', 10);
}

/**
 * Hides the loading spinner.
 */
function hideLoading() {
    loadingSpinner.style.opacity = '0';
    setTimeout(() => loadingSpinner.classList.add('hidden'), 300); // Hide after transition
}

/**
 * Displays a custom message box.
 * @param {string} msg - The message content.
 * @param {'info'|'error'|'success'} type - Type of message for styling.
 */
function showMessage(msg, type = 'info') {
    messageBoxContent.textContent = msg;
    customMessageBox.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[10000] backdrop-blur-sm';
    const messageBoxDiv = customMessageBox.querySelector('div');
    messageBoxDiv.className = 'bg-white p-8 rounded-xl shadow-2xl max-w-sm w-full text-center transform scale-95 opacity-0 transition-all duration-300 ease-out'; // Reset classes for animation
    
    if (type === 'error') {
        messageBoxDiv.classList.add('error'); // Add specific styling for error messages
    } else if (type === 'success') {
        messageBoxDiv.classList.add('success'); // Add a class for success messages
    }
    customMessageBox.classList.remove('hidden');
    setTimeout(() => {
        messageBoxDiv.classList.remove('scale-95', 'opacity-0');
        messageBoxDiv.classList.add('scale-100', 'opacity-100');
    }, 10); // Trigger popIn animation
}

/**
 * Closes the custom message box.
 */
function closeMessage() {
    const messageBoxDiv = customMessageBox.querySelector('div');
    messageBoxDiv.classList.remove('scale-100', 'opacity-100');
    messageBoxDiv.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        customMessageBox.classList.add('hidden');
        messageBoxDiv.classList.remove('error', 'success'); // Clean up classes
    }, 300); // Hide after transition
}

/**
 * Safely displays JSON data in a <pre> tag.
 * @param {HTMLElement} element - The <pre> element to display JSON in.
 * @param {Object} data - The JSON data object.
 */
function displayJsonInCodeView(element, data) {
    const replacer = (key, value) => {
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (value && typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
             return new Date(value.seconds * 1000 + value.nanoseconds / 1000000).toISOString();
        }
        return value;
    };
    element.textContent = JSON.stringify(data, replacer, 2); // 2 for indentation
}

/**
 * Formats a Firestore Timestamp object into a human-readable string (e.g., "5 minutes ago").
 * @param {Object} timestamp - The Firestore Timestamp object.
 * @returns {string} Formatted date string.
 */
function formatFirestoreTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp.seconds * 1000); // Convert seconds to milliseconds
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    // Fallback to a standard locale string for older dates
    return date.toLocaleString();
}


// --- Firebase Authentication and Initialization ---

// Listener for authentication state changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        document.getElementById('displayUserId').textContent = currentUserId;
        await checkAdminStatus(user.uid); // Check admin status on auth state change
        hideLoading();
    } else {
        // User is signed out or not authenticated
        currentUserId = null;
        isAdminUser = false;
        document.getElementById('displayUserId').textContent = 'Not Authenticated';
        adminLoginSection.classList.remove('hidden'); // Show login if not authenticated
        adminDashboard.classList.add('hidden'); // Hide dashboard
        if (unsubscribeAdminRepairs) {
            unsubscribeAdminRepairs(); // Unsubscribe admin listener on logout to prevent errors
            unsubscribeAdminRepairs = null;
        }
        try {
            // Attempt to sign in anonymously for customer view if no user is logged in
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Firebase Auth Error during anonymous sign-in:", error);
            showMessage("Authentication failed. Please try again later.", 'error');
        }
        hideLoading();
    }
});

/**
 * Checks if the current user is an administrator by looking up their profile in Firestore.
 * @param {string} uid - The User ID of the currently authenticated user.
 */
async function checkAdminStatus(uid) {
    if (!uid) {
        isAdminUser = false;
        return;
    }
    try {
        // Path to the admin's profile document: artifacts/{APP_ID}/users/{uid}/profile/admin_profile
        const adminProfileRef = doc(db, `artifacts/${APP_ID}/users/${uid}/profile/admin_profile`);
        const docSnap = await getDoc(adminProfileRef);

        if (docSnap.exists() && docSnap.data().isAdmin === true) {
            isAdminUser = true;
            adminLoginSection.classList.add('hidden'); // Hide login form
            adminDashboard.classList.remove('hidden'); // Show admin dashboard
            loadAdminRepairs(); // Load repairs if admin
            console.log("Admin login successful. Dashboard visible."); // Debug log
        } else {
            isAdminUser = false;
            adminLoginSection.classList.remove('hidden'); // Show login if not admin
            adminDashboard.classList.add('hidden'); // Hide dashboard
            console.log("User is not an admin. Dashboard hidden."); // Debug log
        }
    } catch (error) {
        console.error("Error checking admin status:", error);
        isAdminUser = false; // Default to not admin on error
        adminLoginSection.classList.remove('hidden'); // Show login on error
        adminDashboard.classList.add('hidden'); // Hide dashboard
        showMessage('Error verifying admin status. Please try again.', 'error');
    }
}


// --- Customer View Logic ---

// Event listener for checking repair status
checkStatusButton.addEventListener('click', async () => {
    const repairId = repairIdInput.value.trim();
    if (!repairId) {
        showMessage('Please enter a Repair ID.', 'error');
        return;
    }
    showLoading('Checking status...');
    try {
        // Public data path: /artifacts/{appId}/public/data/repairs/{repairId}
        const repairDocRef = doc(db, `artifacts/${APP_ID}/public/data/repairs`, repairId);
        const docSnap = await getDoc(repairDocRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            displayDeviceName.textContent = data.deviceName || 'Device';
            displayStatus.textContent = data.status;
            // Apply status-specific color class
            displayStatus.className = `font-bold status-${data.status.toLowerCase().replace(/\s/g, '-')}`;
            displayLastUpdated.textContent = formatFirestoreTimestamp(data.lastUpdated);

            // Conditionally display optional fields
            displayModelNumberContainer.classList.toggle('hidden', !data.modelNumber);
            displayModelNumber.textContent = data.modelNumber || '';

            displayCustomerNameContainer.classList.toggle('hidden', !data.customerName);
            displayCustomerName.textContent = data.customerName || '';

            displayPhoneNumberContainer.classList.toggle('hidden', !data.phoneNumber);
            displayPhoneNumber.textContent = data.phoneNumber || '';

            displayNotesContainer.classList.toggle('hidden', !data.notes);
            displayNotes.textContent = data.notes || '';

            repairStatusDisplay.classList.remove('hidden');
            printRepairButton.classList.remove('hidden');
        } else {
            repairStatusDisplay.classList.add('hidden');
            printRepairButton.classList.add('hidden');
            // Hide all optional fields if repair ID not found
            displayModelNumberContainer.classList.add('hidden');
            displayCustomerNameContainer.classList.add('hidden');
            displayPhoneNumberContainer.classList.add('hidden');
            displayNotesContainer.classList.add('hidden');
            showMessage('Repair ID not found. Please check and try again.', 'error');
        }
    } catch (error) {
        console.error("Error fetching repair status:", error);
        showMessage('Failed to retrieve status. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});

// Event listener for printing repair ticket
printRepairButton.addEventListener('click', () => {
    const repairId = repairIdInput.value.trim();
    if (!repairId) {
        showMessage('No repair details to print. Please search for a repair first.', 'error');
        return;
    }

    const deviceName = displayDeviceName.textContent;
    const modelNumber = displayModelNumberContainer.classList.contains('hidden') ? 'N/A' : displayModelNumber.textContent;
    const customerName = displayCustomerNameContainer.classList.contains('hidden') ? 'N/A' : displayCustomerName.textContent;
    const phoneNumber = displayPhoneNumberContainer.classList.contains('hidden') ? 'N/A' : displayPhoneNumber.textContent;
    const status = displayStatus.textContent;
    const lastUpdated = displayLastUpdated.textContent;
    const notes = displayNotesContainer.classList.contains('hidden') ? 'N/A' : displayNotes.textContent;

    const printContent = `
        <div style="font-family: 'Inter', sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
            <h1 style="text-align: center; color: #1e40af; margin-bottom: 20px;">Mobile Doctor Repair Ticket</h1>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 1.1em; margin-bottom: 10px;"><strong>Repair ID:</strong> ${repairId}</p>
            <p style="font-size: 1.1em; margin-bottom: 10px;"><strong>Device Name:</strong> ${deviceName}</p>
            <p style="font-size: 1.1em; margin-bottom: 10px;"><strong>Model Number:</strong> ${modelNumber}</p>
            <p style="font-size: 1.1em; margin-bottom: 10px;"><strong>Customer Name:</strong> ${customerName}</p>
            <p style="font-size: 1.1em; margin-bottom: 10px;"><strong>Phone Number:</strong> ${phoneNumber}</p>
            <p style="font-size: 1.1em; margin-bottom: 10px;"><strong>Current Status:</strong> <span style="color: #16a34a; font-weight: bold;">${status}</span></p>
            <p style="font-size: 1.1em; margin-bottom: 10px;"><strong>Last Updated:</strong> ${lastUpdated}</p>
            <p style="font-size: 1.1em; margin-bottom: 10px;"><strong>Notes:</strong> ${notes}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="text-align: center; color: #777; font-size: 0.9em;">Thank you for choosing Mobile Doctor!</p>
        </div>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Repair Ticket</title>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
});


// --- Admin Login/Logout Logic ---

// Event listener for admin login
adminLoginButton.addEventListener('click', async () => {
    const email = adminEmailInput.value.trim();
    const password = adminPasswordInput.value.trim();

    if (!email || !password) {
        showMessage('Please enter both email and password.', 'error');
        return;
    }

    showLoading('Logging in...');
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showMessage('Logged in successfully!', 'success');
        // checkAdminStatus will be called by onAuthStateChanged listener
    } catch (error) {
        console.error("Admin login error:", error);
        let errorMessage = 'Login failed. Please check your credentials.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Invalid email or password.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email format.';
        } else if (error.code === 'auth/network-request-failed') {
             errorMessage = 'Network error. Check your internet connection or Content Security Policy.';
        }
        showMessage(errorMessage, 'error');
    } finally {
        hideLoading();
        adminPasswordInput.value = ''; // Clear password field for security
    }
});

// Event listener for admin logout
adminLogoutButton.addEventListener('click', async () => {
    showLoading('Logging out...');
    try {
        await signOut(auth);
        showMessage('Logged out successfully!', 'success');
    } catch (error) {
        console.error("Logout error:", error);
        showMessage('Failed to log out. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});


// --- Admin Dashboard Logic ---

// Auto-generate Repair ID for new repair form
generateRepairIdButton.addEventListener('click', () => {
    const prefix = "MD-";
    const uniqueId = uuidv4().substring(0, 5).toUpperCase(); // Get first 5 chars of UUID
    newRepairId.value = prefix + uniqueId;
    // Trigger input event to update JSON view immediately
    newRepairId.dispatchEvent(new Event('input'));
});

/**
 * Loads and sets up a real-time listener for admin repairs from Firestore.
 */
async function loadAdminRepairs() {
    if (!currentUserId || !isAdminUser) {
        // This case should ideally not be hit if checkAdminStatus works correctly,
        // but it's a safeguard.
        showMessage('Not authorized to load admin data.', 'error');
        return;
    }

    showLoading('Loading admin repairs...');
    try {
        const repairsCollectionRef = collection(db, `artifacts/${APP_ID}/users/${currentUserId}/repairs`);
        let q = query(repairsCollectionRef);

        // Apply sorting based on selected option
        const sortBy = adminSortBy.value;
        if (sortBy === 'lastUpdated') {
            q = query(q, orderBy('lastUpdated', 'desc'));
        } else if (sortBy === 'deviceName') {
            q = query(q, orderBy('deviceName', 'asc'));
        } else if (sortBy === 'status') {
            // For status, sort by status then by last updated for consistent ordering
            q = query(q, orderBy('status', 'asc'), orderBy('lastUpdated', 'desc'));
        }

        // Unsubscribe from previous listener if it exists to avoid multiple listeners
        if (unsubscribeAdminRepairs) {
            unsubscribeAdminRepairs();
        }

        // Set up new real-time listener
        unsubscribeAdminRepairs = onSnapshot(q, (snapshot) => {
            currentAdminRepairsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderFilteredAndSortedAdminRepairs(); // Re-render with any applied filters/sorts
            hideLoading();
        }, (error) => {
            console.error("Error fetching admin repairs in real-time:", error);
            showMessage('Failed to load admin repairs. Please try again.', 'error');
            hideLoading();
        });
    } catch (error) {
        console.error("Error setting up admin listener:", error);
        showMessage('Failed to set up admin data listener.', 'error');
        hideLoading();
    }
}

/**
 * Filters and sorts the current admin repairs data and then renders them to the UI.
 */
function renderFilteredAndSortedAdminRepairs() {
    let filteredRepairs = [...currentAdminRepairsData]; // Create a mutable copy to apply filters/sorts

    // Apply status filter
    const filterStatus = adminFilterStatus.value;
    if (filterStatus !== 'All') {
        filteredRepairs = filteredRepairs.filter(repair => repair.status === filterStatus);
    }

    // Apply search term filter
    const searchTerm = adminSearchInput.value.toLowerCase().trim();
    if (searchTerm) {
        filteredRepairs = filteredRepairs.filter(repair =>
            repair.id.toLowerCase().includes(searchTerm) ||
            repair.deviceName.toLowerCase().includes(searchTerm) ||
            (repair.customerName && repair.customerName.toLowerCase().includes(searchTerm)) ||
            (repair.phoneNumber && repair.phoneNumber.toLowerCase().includes(searchTerm)) ||
            (repair.notes && repair.notes.toLowerCase().includes(searchTerm)) // Search notes too
        );
    }

    renderAdminRepairs(filteredRepairs);
}

// Event listeners for search, filter, and sort controls
adminSearchInput.addEventListener('input', renderFilteredAndSortedAdminRepairs);
adminFilterStatus.addEventListener('change', renderFilteredAndSortedAdminRepairs);
// For sort, we reload the listener to ensure Firestore handles the ordering
adminSortBy.addEventListener('change', loadAdminRepairs);


/**
 * Renders the given array of repair objects to the admin repairs list UI.
 * @param {Array<Object>} repairsToRender - The array of repair objects to display.
 */
function renderAdminRepairs(repairsToRender) {
    repairsList.innerHTML = ''; // Clear previous list items
    if (repairsToRender.length === 0) {
        repairsList.innerHTML = '<p class="text-center text-gray-600 p-5 bg-gray-50 rounded-lg shadow-sm border border-gray-200">No repairs found matching your criteria. Add one above!</p>';
        return;
    }

    repairsToRender.forEach(repair => {
        const repairCard = document.createElement('div');
        repairCard.className = 'bg-gray-50 p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center animate-fadeIn';
        repairCard.innerHTML = `
            <div class="flex-grow mb-3 sm:mb-0">
                <p class="text-xl font-bold text-gray-800">${repair.deviceName || 'Device'} (<span class="text-purple-600">${repair.id}</span>)</p>
                ${repair.modelNumber ? `<p class="text-md text-gray-600">Model: ${repair.modelNumber}</p>` : ''}
                ${repair.customerName ? `<p class="text-md text-gray-600">Customer: ${repair.customerName}</p>` : ''}
                ${repair.phoneNumber ? `<p class="text-md text-gray-600">Phone: ${repair.phoneNumber}</p>` : ''}
                <p class="text-lg text-gray-700">Status: <span class="font-semibold status-${repair.status.toLowerCase().replace(/\s/g, '-')}">${repair.status}</span></p>
                ${repair.notes ? `<p class="text-sm text-gray-500">Notes: ${repair.notes}</p>` : ''}
                <p class="text-xs text-gray-400 mt-1">Last Updated: ${formatFirestoreTimestamp(repair.lastUpdated)}</p>
                <p class="text-xs text-gray-400">Created: ${formatFirestoreTimestamp(repair.createdAt)}</p>
            </div>
            <div class="flex gap-3 mt-4 sm:mt-0">
                <button data-id="${repair.id}" class="edit-btn bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-colors duration-200 shadow-md transform hover:scale-105">
                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    Edit
                </button>
                <button data-id="${repair.id}" class="delete-btn bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors duration-200 shadow-md transform hover:scale-105">
                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Delete
                </button>
            </div>
        `;
        repairsList.appendChild(repairCard);
    });

    // Add event listeners for edit and delete buttons after rendering
    repairsList.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => openEditModal(e.target.dataset.id));
    });
    repairsList.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => handleDeleteRepair(e.target.dataset.id));
    });
}

/**
 * Returns a Tailwind CSS class for text color based on repair status.
 * @param {string} status - The repair status.
 * @returns {string} Tailwind CSS text color class.
 */
function getStatusColorClass(status) {
    switch (status) {
        case 'Received': return 'status-received';
        case 'Diagnosing': return 'status-diagnosing';
        case 'Repairing': return 'status-repairing';
        case 'Ready for Pickup': return 'status-ready';
        case 'Completed': return 'status-completed';
        case 'Cancelled': return 'status-cancelled';
        default: return 'text-gray-600';
    }
}


// Event listener for input changes in the "Add New Repair" section to update the code view
document.querySelectorAll('#newRepairId, #newDeviceName, #newModelNumber, #newCustomerName, #newPhoneNumber, #newStatus, #newNotes').forEach(input => {
    input.addEventListener('input', () => {
        const id = newRepairId.value.trim();
        const deviceName = newDeviceName.value.trim();
        const modelNumber = newModelNumber.value.trim();
        const customerName = newCustomerName.value.trim();
        const phoneNumber = newPhoneNumber.value.trim();
        const status = newStatus.value;
        const notes = newNotes.value.trim();

        const previewData = {
            repairId: id || '...',
            deviceName: deviceName || '...',
            modelNumber: modelNumber || (modelNumber === '' ? '' : '...'),
            customerName: customerName || (customerName === '' ? '' : '...'),
            phoneNumber: phoneNumber || (phoneNumber === '' ? '' : '...'),
            status: status || '...',
            notes: notes || (notes === '' ? '' : '...'),
            lastUpdated: new Date(),
            createdAt: new Date()
        };
        displayJsonInCodeView(newRepairCodeView, previewData);
    });
});

/**
 * Handles adding a new repair record to Firestore.
 */
addRepairButton.addEventListener('click', async () => {
    const id = newRepairId.value.trim();
    const deviceName = newDeviceName.value.trim();
    const modelNumber = newModelNumber.value.trim();
    const customerName = newCustomerName.value.trim();
    const phoneNumber = newPhoneNumber.value.trim();
    const status = newStatus.value;
    const notes = newNotes.value.trim();

    // Basic validation
    if (!id || !deviceName) {
        showMessage('Repair ID and Device Name are required.', 'error');
        return;
    }

    if (!isAdminUser) {
        showMessage('You must be logged in as an admin to add repairs.', 'error');
        return;
    }

    showLoading('Adding repair...');
    try {
        // Paths for private (admin) and public (customer) data
        const userRepairDocRef = doc(db, `artifacts/${APP_ID}/users/${currentUserId}/repairs`, id);
        const publicRepairDocRef = doc(db, `artifacts/${APP_ID}/public/data/repairs`, id);

        // Check if repair ID already exists to prevent overwrites
        const docSnap = await getDoc(userRepairDocRef);
        if (docSnap.exists()) {
            showMessage(`Repair ID "${id}" already exists. Please use a different one or generate a new ID.`, 'error');
            hideLoading();
            return;
        }

        // Prepare repair data
        const repairData = {
            deviceName: deviceName,
            status: status,
            lastUpdated: new Date(),
            createdAt: new Date()
        };

        // Add optional fields only if they have values
        if (modelNumber) repairData.modelNumber = modelNumber;
        if (customerName) repairData.customerName = customerName;
        if (phoneNumber) repairData.phoneNumber = phoneNumber;
        if (notes) repairData.notes = notes;

        // Save to both private and public collections
        await setDoc(userRepairDocRef, repairData);
        await setDoc(publicRepairDocRef, repairData);

        displayJsonInCodeView(newRepairCodeView, { repairId: id, ...repairData });

        // Clear form fields after successful addition
        newRepairId.value = '';
        newDeviceName.value = '';
        newModelNumber.value = '';
        newCustomerName.value = '';
        newPhoneNumber.value = '';
        newStatus.value = 'Received';
        newNotes.value = '';
        showMessage('Repair added successfully!', 'success');
    } catch (error) {
        console.error("Error adding repair:", error);
        showMessage('Failed to add repair. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});

/**
 * Opens the edit modal and populates it with existing repair data.
 * @param {string} id - The ID of the repair to edit.
 */
async function openEditModal(id) {
    if (!isAdminUser) {
        showMessage('You must be logged in as an admin to edit repairs.', 'error');
        return;
    }
    showLoading('Loading repair details...');
    try {
        const repairDocRef = doc(db, `artifacts/${APP_ID}/users/${currentUserId}/repairs`, id);
        const docSnap = await getDoc(repairDocRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            editingRepairId = id; // Store ID of repair being edited
            editModalTitle.textContent = `Edit Repair: ${id}`;
            editDeviceName.value = data.deviceName || '';
            editModelNumber.value = data.modelNumber || '';
            editCustomerName.value = data.customerName || '';
            editPhoneNumber.value = data.phoneNumber || '';
            editStatus.value = data.status || 'Received';
            editNotes.value = data.notes || '';

            displayJsonInCodeView(editRepairCodeView, { repairId: id, ...data });

            editRepairModal.classList.remove('hidden');
            // Trigger popIn animation for modal
            setTimeout(() => {
                editRepairModal.querySelector('div').classList.remove('scale-95', 'opacity-0');
                editRepairModal.querySelector('div').classList.add('scale-100', 'opacity-100');
            }, 10);


            // Add input listeners for real-time JSON view update in modal
            document.querySelectorAll('#editDeviceName, #editModelNumber, #editCustomerName, #editPhoneNumber, #editStatus, #editNotes').forEach(input => {
                input.oninput = () => {
                    const currentEditData = {
                        repairId: editingRepairId,
                        deviceName: editDeviceName.value.trim(),
                        modelNumber: editModelNumber.value.trim(),
                        customerName: editCustomerName.value.trim(),
                        phoneNumber: editPhoneNumber.value.trim(),
                        status: editStatus.value,
                        notes: editNotes.value.trim(),
                        lastUpdated: new Date(), // Update lastUpdated on any change in edit modal
                    };
                    displayJsonInCodeView(editRepairCodeView, currentEditData);
                };
            });

        } else {
            showMessage('Repair not found for editing.', 'error');
        }
    } catch (error) {
        console.error("Error opening edit modal:", error);
        showMessage('Failed to load repair for editing.', 'error');
    } finally {
        hideLoading();
    }
}

// Event listener for canceling edit operation
cancelEditButton.addEventListener('click', () => {
    const modalContent = editRepairModal.querySelector('div');
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        editRepairModal.classList.add('hidden');
        editingRepairId = null; // Clear editing state
        editRepairCodeView.textContent = ''; // Clear JSON view
    }, 300); // Hide after transition
});

/**
 * Saves the edited repair details to Firestore.
 */
saveEditButton.addEventListener('click', async () => {
    if (!editingRepairId) return; // Safeguard if no repair is being edited
    if (!isAdminUser) {
        showMessage('You must be logged in as an admin to save changes.', 'error');
        return;
    }

    showLoading('Saving changes...');
    try {
        // References to both private and public documents
        const userRepairDocRef = doc(db, `artifacts/${APP_ID}/users/${currentUserId}/repairs`, editingRepairId);
        const publicRepairDocRef = doc(db, `artifacts/${APP_ID}/public/data/repairs`, editingRepairId);

        // Prepare updated data object
        const updatedData = {
            deviceName: editDeviceName.value.trim(),
            status: editStatus.value,
            lastUpdated: new Date() // Update timestamp on save
        };

        // Add optional fields if they have values, otherwise ensure they are cleared if empty
        updatedData.modelNumber = editModelNumber.value.trim();
        updatedData.customerName = editCustomerName.value.trim();
        updatedData.phoneNumber = editPhoneNumber.value.trim();
        updatedData.notes = editNotes.value.trim();

        // Perform batch update for consistency (optional, but good practice)
        // For simplicity, using individual updates here.
        await updateDoc(userRepairDocRef, updatedData);
        await updateDoc(publicRepairDocRef, updatedData);

        displayJsonInCodeView(editRepairCodeView, { repairId: editingRepairId, ...updatedData });

        // Close modal and reset state
        const modalContent = editRepairModal.querySelector('div');
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            editRepairModal.classList.add('hidden');
            editingRepairId = null;
        }, 300); // Hide after transition

        showMessage('Repair updated successfully!', 'success');
    } catch (error) {
        console.error("Error updating repair:", error);
        showMessage('Failed to update repair. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});

/**
 * Handles deleting a repair record after user confirmation.
 * @param {string} id - The ID of the repair to delete.
 */
async function handleDeleteRepair(id) {
    if (!isAdminUser) {
        showMessage('You must be logged in as an admin to delete repairs.', 'error');
        return;
    }

    // Custom confirmation dialog
    const confirmDelete = await new Promise(resolve => {
        const msgBox = document.createElement('div');
        msgBox.id = 'confirmDeleteBox';
        msgBox.className = 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[10000] backdrop-blur-sm';
        msgBox.innerHTML = `
            <div class="bg-white p-8 rounded-xl shadow-2xl max-w-sm w-full text-center transform scale-95 opacity-0 transition-all duration-300 ease-out">
                <p class="text-lg font-semibold mb-6 text-gray-800">Are you sure you want to delete this repair? This action cannot be undone.</p>
                <div class="flex justify-center gap-4">
                    <button id="confirmYes" class="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition-colors shadow-md transform hover:scale-105">Yes, Delete</button>
                    <button id="confirmNo" class="bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-bold hover:bg-gray-400 transition-colors shadow-md transform hover:scale-105">No, Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(msgBox);

        // Trigger popIn animation for confirm box
        setTimeout(() => {
            msgBox.querySelector('div').classList.remove('scale-95', 'opacity-0');
            msgBox.querySelector('div').classList.add('scale-100', 'opacity-100');
        }, 10);

        document.getElementById('confirmYes').onclick = () => {
            const modalContent = msgBox.querySelector('div');
            modalContent.classList.remove('scale-100', 'opacity-100');
            modalContent.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                msgBox.remove();
                resolve(true);
            }, 300);
        };
        document.getElementById('confirmNo').onclick = () => {
            const modalContent = msgBox.querySelector('div');
            modalContent.classList.remove('scale-100', 'opacity-100');
            modalContent.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                msgBox.remove();
                resolve(false);
            }, 300);
        };
    });

    if (!confirmDelete) {
        return; // User cancelled the delete operation
    }

    showLoading('Deleting repair...');
    try {
        // Delete from both private (admin) and public (customer) collections
        const userRepairDocRef = doc(db, `artifacts/${APP_ID}/users/${currentUserId}/repairs`, id);
        const publicRepairDocRef = doc(db, `artifacts/${APP_ID}/public/data/repairs`, id);

        await deleteDoc(userRepairDocRef);
        await deleteDoc(publicRepairDocRef);

        showMessage('Repair deleted successfully!', 'success');
    } catch (error) {
        console.error("Error deleting repair:", error);
        showMessage('Failed to delete repair. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Event Listeners for custom message box
messageBoxCloseButton.addEventListener('click', closeMessage);

// --- Initial Setup and Dynamic Content ---

// Set current year in footer dynamically
document.getElementById('currentYear').textContent = new Date().getFullYear();

// Initialize the new repair code view with default/empty data on load
document.addEventListener('DOMContentLoaded', () => {
    displayJsonInCodeView(newRepairCodeView, {
        repairId: '...',
        deviceName: '...',
        modelNumber: '...',
        customerName: '...',
        phoneNumber: '...',
        status: '...',
        notes: '...',
        lastUpdated: '...',
        createdAt: '...'
    });
});


// --- Dynamic Tab Title Logic ---
const originalTitle = document.title; // Store the initial title
const titles = [
    "Your Repair Status! 🔧",
    "Need an Update? Check Now! ✨",
    "Mobile Doctor: Progress! ⚙️",
    "Device Repair Updates! 📱",
    "Don't Miss Out! Get Updates!"
];
let titleIndex = 0;
let titleInterval; // Variable to hold the interval ID

/**
 * Changes the document title to cycle through predefined messages.
 */
function changeTitle() {
    document.title = titles[titleIndex];
    titleIndex = (titleIndex + 1) % titles.length; // Cycle through titles
}

// Event listener for when the tab loses focus
window.addEventListener('blur', () => {
    // Start changing title every 3 seconds when tab is not in focus
    titleInterval = setInterval(changeTitle, 3000);
});

// Event listener for when the tab gains focus
window.addEventListener('focus', () => {
    clearInterval(titleInterval); // Stop changing title
    document.title = originalTitle; // Revert to original title
});

// --- End Dynamic Tab Title Logic ---
