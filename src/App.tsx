import ImageUploader from "./components/ImageUploader";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <>
      {/* Toast notifications */}
      <Toaster position="bottom-center" reverseOrder={false} />

      <main className="min-h-screen bg-gray-100 flex items-center justify-center">
        <ImageUploader />
      </main>
    </>
  );
}

export default App;
