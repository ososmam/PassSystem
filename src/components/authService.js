import { 
    firestore, 
    firebaseAuth,
    remoteConfig
  } from "./firebaseApp";
  import { 
    collection, 
    doc, 
    query, 
    where, 
    getDocs, 
    getDoc,
    updateDoc,
    arrayUnion
  } from "firebase/firestore";
  import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    RecaptchaVerifier
  } from "firebase/auth";
  import {
      fetchAndActivate,
      getValue,
    } from "firebase/remote-config";
  
  setPersistence(firebaseAuth, browserLocalPersistence);
  
  export const authService = {
    recaptchaVerifier: null,
    
    initializeRecaptcha(containerId) {
      // Clear any existing reCAPTCHA
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
      
      try {
        this.recaptchaVerifier = new RecaptchaVerifier(
          containerId, 
          {
            size: 'invisible',
            callback: (response) => {
              console.log("reCAPTCHA solved", response);
            }
          }, 
          firebaseAuth
        );
        
        window.recaptchaVerifier = this.recaptchaVerifier;
        return true;
      } catch (error) {
        console.error("reCAPTCHA initialization error:", error);
        throw error;
      }
    },
    async login(phone, password) {
      try {
        console.log(phone);
        console.log(password);
        await signInWithEmailAndPassword(firebaseAuth, `${phone}@dm2.test`, password);
        return true;
      } catch (error) {
        throw error;
      }
    },
  
    async logout() {
      await signOut(firebaseAuth);
    },
  
    async checkDeviceLimit(userId, currentDeviceId) {
      try {
        await fetchAndActivate(remoteConfig);
        const maxDevices = getValue (remoteConfig,('max_allowed_devices')).asNumber() || 1;
  
        const userRef = doc(firestore, "hosts", userId);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
  
        if (!userData.deviceIds) {
          await updateDoc(userRef, {
            deviceIds: [currentDeviceId]
          });
          return true;
        }
  
        if (userData.deviceIds.includes(currentDeviceId)) {
          return true;
        }
  
        if (userData.deviceIds.length >= maxDevices) {
          return false;
        }
  
        await updateDoc(userRef, {
          deviceIds: arrayUnion(currentDeviceId)
        });
        return true;
      } catch (error) {
        console.error("Device check error:", error);
        throw error;
      }
    },
  
    async verifyUser(phone) {
      const userDocRef = collection(firestore, "hosts");
      const q = query(userDocRef, 
        where("phone", "==", phone),
        where("verifiedAccount", "==", true)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty ? null : {
        id: querySnapshot.docs[0].id,
        ...querySnapshot.docs[0].data()
      };
    },
  
    onAuthStateChanged(callback) {
      return onAuthStateChanged(firebaseAuth, callback);
    },
  
    initializeRecaptcha(containerId) {
      window.recaptchaVerifier = new RecaptchaVerifier(containerId, {
        size: 'invisible',
        callback: () => {}
      }, firebaseAuth);
    }
  };