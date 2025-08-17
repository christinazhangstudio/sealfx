"use client";

import React, { useState, useEffect } from "react";
import { Comfortaa } from "next/font/google";

const comfortaa = Comfortaa({
  weight: "400",
  subsets: ["latin"],
});

interface StickyNote {
  id: string;
  content: string;
  color: string;
}

const StickyNotesPage: React.FC = () => {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState("");

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem("stickyNotes");
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    }
  }, []);

  // Save notes to localStorage whenever notes change
  useEffect(() => {
    localStorage.setItem("stickyNotes", JSON.stringify(notes));
  }, [notes]);

  // Generate a simple unique ID
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  };

  // Create a new sticky note
  const createNote = () => {
    if (!newNoteContent.trim()) return;
    const newNote: StickyNote = {
      id: generateId(),
      content: newNoteContent,
      color: getRandomColor(),
    };
    setNotes([...notes, newNote]);
    setNewNoteContent("");
  };

  // Delete a note
  const deleteNote = (id: string) => {
    setNotes(notes.filter((note) => note.id !== id));
  };

  // Copy note content to clipboard
  const copyNote = (content: string) => {
    navigator.clipboard.writeText(content);
    alert("Note copied to clipboard!");
  };

  // Update note content
  const updateNote = (id: string, newContent: string) => {
    setNotes(
      notes.map((note) =>
        note.id === id ? { ...note, content: newContent } : note
      )
    );
  };

  // Get random color for note backgrounds
  const getRandomColor = () => {
    const colors = [
      "bg-yellow-200",
      "bg-pink-200",
      "bg-green-200",
      "bg-blue-200",
      "bg-purple-200",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8 ${comfortaa.className}`}>
      <h1 className="text-3xl font-bold mb-6 text-center text-white">
        Notes
      </h1>

      {/* Create Note Form */}
      <div className="mb-6 flex justify-center">
        <textarea
          className="w-full max-w-md bg-gradient-to-b from-blue-100 via-pink-100 to-pink-0 border-2 border-blue-900 text-blue-900 py-4 px-4 shadow-sm rounded-lg"
          placeholder="Write a new note..."
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
        />
        <button
          className="ml-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed transition-colors"
          onClick={createNote}
          disabled={!newNoteContent.trim()}
        >
          Add Note
        </button>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {notes.map((note) => (
          <div
            key={note.id}
            className={`relative ${note.color} p-4 rounded-lg shadow-md flex flex-col justify-between border-2 border-pink-600`}
            style={{
              height: "200px",
              width: "100%",
              maxWidth: "300px",
            }}
          >
            <textarea
              className="w-full h-3/4 p-2 border-2 border-pink-600 text-white bg-gray-800 rounded-lg resize-none"
              value={note.content}
              onChange={(e) => updateNote(note.id, e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <button
                className="px-2 py-1 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed transition-colors mr-2"
                onClick={() => updateNote(note.id, note.content)}
                disabled={!note.content.trim()}
              >
                Save
              </button>
              <button
                className="px-2 py-1 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors mr-2"
                onClick={() => copyNote(note.content)}
              >
                Copy
              </button>
              <button
                className="px-2 py-1 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
                onClick={() => deleteNote(note.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StickyNotesPage;