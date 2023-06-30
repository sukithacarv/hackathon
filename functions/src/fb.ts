import admin from 'firebase-admin';

admin.initializeApp();

let firestore: admin.firestore.Firestore | null = null;


const db = (): admin.firestore.Firestore => {

    if (firestore === null) {
        firestore = admin.firestore();
        //firestore.settings({ ignoreUndefinedProperties: true });
    }

    /// Ignore undefined properties from models
    return firestore
}

let authInstance: admin.auth.Auth | null = null;

const auth = (): admin.auth.Auth => {
    if (authInstance === null) {
        authInstance = admin.auth();
    }

    /// Ignore undefined properties from models
    return authInstance;
}

let storageInstance: admin.storage.Storage | null = null;

const storage = (): admin.storage.Storage => {
    if (storageInstance === null) {
        storageInstance = admin.storage();
    }

    /// Ignore undefined properties from models
    return storageInstance;
}

let messagingInstance: admin.messaging.Messaging | null = null;

const messaging = (): admin.messaging.Messaging => {
    if (messagingInstance === null) {
        messagingInstance = admin.messaging();
    }

    /// Ignore undefined properties from models
    return messagingInstance;
}



export { db, auth, storage, messaging };
