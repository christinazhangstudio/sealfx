"use client";
import "../../styles/globals.css";

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

export default function StickyNotesPage() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showCopyPopup, setShowCopyPopup] = useState(false);

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
    if (expandedNoteId === id) setExpandedNoteId(null);
  };

  // Copy note content to clipboard
  const copyNote = (content: string) => {
    navigator.clipboard.writeText(content);
    setShowCopyPopup(true);
    setTimeout(() => setShowCopyPopup(false), 200);
  };

  // Save edited note
  const saveNote = (id: string) => {
    setNotes(
      notes.map((note) =>
        note.id === id ? { ...note, content: editContent } : note
      )
    );
    setExpandedNoteId(null);
  };

  // Get random color for note backgrounds
  const getRandomColor = () => {
    const colors = [
      "bg-yellow-100",
      "bg-pink-200",
      "bg-green-200",
      "bg-blue-200",
      "bg-purple-200",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-pink-50 to-purple-50 p-8 ${comfortaa.className}`}>
      <h1 className="text-3xl font-bold mb-6 text-center text-pink-700">
        Notes
      </h1>

      {/* Create Note Form */}
      <div className="mb-6 flex justify-center">
        <textarea
          className="h-50 w-full max-w-md hover:bg-none focus:outline-none border-2 border-pink-300 text-pink-700 py-4 px-4 shadow-sm rounded-lg placeholder-pink-500"
          placeholder="Write a new note..."
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
        />
        <button
          className="h-16 ml-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed transition-colors"
          onClick={createNote}
          disabled={!newNoteContent.trim()}
        >
          Add Note
        </button>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.map((note) => (
          <div
            key={note.id}
            className={`${
              expandedNoteId === note.id
                ? "fixed inset-0 z-50 bg-opacity-90"
                : "relative"
            } ${note.color} p-4 rounded-lg flex flex-col justify-between border-2 border-pink-100`}
            style={{
              height: expandedNoteId === note.id ? "80vh" : "200px",
              width: expandedNoteId === note.id ? "80vw" : "100%",
              maxWidth: expandedNoteId === note.id ? "800px" : "700px",
              margin: expandedNoteId === note.id ? "auto" : "0",
            }}
          >
            {expandedNoteId === note.id ? (
              <>
                <textarea
                  className="w-full h-full p-2 hover:bg-none focus:outline-none text-blue-800"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
                <div className="flex justify-end mt-2">
                  <button
                    className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300 disabled:cursor-not-allowed transition-colors mr-2"
                    onClick={() => saveNote(note.id)}
                    disabled={!editContent.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
                    onClick={() => setExpandedNoteId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="resize-none whitespace-normal break-words text-sm text-blue-900 overflow-auto">
                  {note.content}
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    className="px-2 py-1 text-pink-600 hover:text-pink-800 mr-2"
                    onClick={() => {
                      setExpandedNoteId(note.id);
                      setEditContent(note.content);
                    }}
                  >
                    Expand
                  </button>
                  <button
                    className="px-2 py-1 text-pink-600 hover:text-pink-800 mr-2"
                    onClick={() => copyNote(note.content)}
                  >
                    Copy
                  </button>
                  <button
                    className="px-2 py-1 text-pink-600 hover:text-pink-800"
                    onClick={() => deleteNote(note.id)}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Copy Popup */}
      {showCopyPopup && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 text-pink-500 px-4 py-2 rounded-lg shadow-md fade-out">
          Copied!
        </div>
      )}

    </div>
  );
};