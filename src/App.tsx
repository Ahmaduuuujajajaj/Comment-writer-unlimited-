import React, { useState, useRef } from 'react';
import { UploadCloud, MessageSquare, Loader2, Video, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [count, setCount] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('video/')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError("Please drop a valid video file.");
      }
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Please select a video file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setComments([]);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('count', count.toString());

    try {
      const response = await fetch('/api/generate-comments', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate comments');
      }

      setComments(data.comments);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-2xl mb-2">
            <MessageSquare className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Social Comment Generator
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Upload your video clip and let AI generate authentic, engaging comments tailored to your content.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-8 space-y-8">
            
            {/* Upload Area */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                1. Upload Video
              </label>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors
                  ${file ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="video/*" 
                  className="hidden" 
                />
                
                {file ? (
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                      <Video className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{file.name}</p>
                      <p className="text-sm text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <p className="text-sm text-blue-600 font-medium hover:underline pt-2">
                      Click to change file
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 bg-slate-200 text-slate-500 rounded-full">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Click to upload or drag and drop</p>
                      <p className="text-sm text-slate-500">MP4, WebM, or MOV (max 500MB)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Configuration */}
            <div className="space-y-4">
              <label htmlFor="count" className="block text-sm font-medium text-slate-700">
                2. Number of Comments
              </label>
              <input
                id="count"
                type="number"
                min="1"
                max="50"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 10)}
                className="w-full md:w-48 px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-xl text-sm font-medium"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              className="w-full py-4 px-6 rounded-xl font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing video & generating comments...</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-5 h-5" />
                  <span>Generate Comments</span>
                </>
              )}
            </button>

          </div>
        </div>

        {/* Results */}
        <AnimatePresence>
          {comments.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 pt-4"
            >
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                <h2 className="text-2xl font-bold tracking-tight">Generated Comments</h2>
              </div>
              
              <div className="grid gap-4">
                {comments.map((comment, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex space-x-4 items-start"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shrink-0 border border-blue-200 font-bold text-blue-700 text-sm">
                      U{index + 1}
                    </div>
                    <div className="pt-2">
                      <p className="text-slate-800 leading-relaxed">{comment}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
