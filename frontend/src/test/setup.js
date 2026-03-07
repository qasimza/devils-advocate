// Add this line to src/test/setup.js
window.HTMLElement.prototype.scrollIntoView = vi.fn()

vi.mock('socket.io-client', () => ({
    io: vi.fn(() => ({
        on: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn(),
    })),
}))

vi.mock('../firebase', () => ({
    auth: {},
    storage: {},
    googleProvider: {},
    githubProvider: {},
    signInAnonymously: vi.fn(),
    signInWithPopup: vi.fn(),
    onAuthStateChanged: vi.fn((auth, cb) => {
        cb({ uid: 'test-uid', isAnonymous: true, displayName: null })
        return vi.fn()
    }),
    signOut: vi.fn(),
    ref: vi.fn(),
    uploadBytesResumable: vi.fn(),
    deleteObject: vi.fn(),
    listAll: vi.fn(() => Promise.resolve({ items: [] })),
    getMetadata: vi.fn(),
}))