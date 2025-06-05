// src/App.tsx

import ImageUploader from "./components/ImageUploader/ImageUploader";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <>
      {/* Toast notifications */}
      <Toaster
        position="bottom-center"
        reverseOrder={false}
        toastOptions={{
          duration: 1500,
          style: {
            marginBottom: "5rem", // push toasts up above buttons
          },
        }}
      />

      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <ImageUploader />
      </main>
    </>
  );
}

export default App;
