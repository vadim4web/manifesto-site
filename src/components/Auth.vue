<!-- src/components/Auth.vue -->
<template>
  <div>
    <h2>Authentication</h2>
    <div v-if="user">
      <p>Welcome, {{ user.displayName || user.phoneNumber || user.email }}!</p>
      <button @click="signOutUser">Sign Out</button>
    </div>
    <div v-else>
      <h3>Sign In</h3>
      <!-- Google Sign-In -->
      <button @click="signInWithGoogle">Sign In with Google</button>

      <!-- Phone Number Sign-In -->
      <h4>Sign In with Phone</h4>
      <input type="tel" v-model="phoneNumber" placeholder="+1234567890">
      <button @click="sendVerificationCode" :disabled="!phoneNumber || !!confirmationResult">Send Code</button>
      <div v-if="confirmationResult">
        <input type="text" v-model="verificationCode" placeholder="Verification Code">
        <button @click="verifyPhoneNumber">Verify Code</button>
      </div>
      <div id="recaptcha-container"></div>
    </div>

    <p v-if="error" style="color: red;">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'firebase/auth';
import { auth } from '../firebase'; // Import the initialized auth instance

// State variables
const user = ref(null);
const error = ref(null);
const phoneNumber = ref('');
const verificationCode = ref('');
const confirmationResult = ref(null); // Stores the result of sending the verification code

// Listen for auth state changes
onMounted(() => {
  onAuthStateChanged(auth, (currentUser) => {
    user.value = currentUser;
    error.value = null; // Clear error on auth state change
    phoneNumber.value = ''; // Clear phone number field
    verificationCode.value = ''; // Clear verification code field
    confirmationResult.value = null; // Clear confirmation result
  });

  // Initialize reCAPTCHA Verifier for phone sign-in
  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    'size': 'invisible', // or 'normal' if you want it visible
    'callback': (response) => {
      // reCAPTCHA solved, allow signInWithPhoneNumber.
      // Call sendVerificationCode() here if you had an explicit button for it
      console.log("reCAPTCHA callback", response);
    },
    'expired-callback': () => {
      // Response expired. Ask user to solve reCAPTCHA again.
      console.log("reCAPTCHA expired");
    }
  });
});

// --- Google Sign-In ---
const signInWithGoogle = async () => {
  error.value = null;
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    // User signed in successfully
    console.log("Google Sign-In successful:", result.user);
  } catch (err) {
    console.error("Google Sign-In error:", err.message);
    error.value = err.message;
  }
};

// --- Phone Number Sign-In ---
const sendVerificationCode = async () => {
  error.value = null;
  try {
    // Check if reCAPTCHA is ready
    const appVerifier = window.recaptchaVerifier;
    if (!appVerifier) {
      error.value = "reCAPTCHA not initialized. Please try again.";
      return;
    }
    
    confirmationResult.value = await signInWithPhoneNumber(auth, phoneNumber.value, appVerifier);
    console.log("Verification code sent:", confirmationResult.value);
    window.alert("Verification code sent to your phone!");
  } catch (err) {
    console.error("Error sending verification code:", err.message);
    error.value = err.message;
    confirmationResult.value = null; // Reset if error
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.render().then(widgetId => {
        grecaptcha.reset(widgetId); // Reset reCAPTCHA if it failed
      });
    }
  }
};

const verifyPhoneNumber = async () => {
  error.value = null;
  if (!confirmationResult.value) {
    error.value = "No verification code sent. Please send a code first.";
    return;
  }
  try {
    await confirmationResult.value.confirm(verificationCode.value);
    // User signed in successfully
    console.log("Phone number verified.");
  } catch (err) {
    console.error("Error verifying phone number:", err.message);
    error.value = err.message;
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.render().then(widgetId => {
        grecaptcha.reset(widgetId); // Reset reCAPTCHA if verification failed
      });
    }
  }
};

// --- Sign Out ---
const signOutUser = async () => {
  error.value = null;
  try {
    await signOut(auth);
    console.log("User signed out.");
  } catch (err) {
    console.error("Sign Out error:", err.message);
    error.value = err.message;
  }
};
</script>
