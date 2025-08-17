"use client";
import "../../styles/globals.css";

import React, { useState, useEffect } from "react";
import { Comfortaa, Inconsolata } from "next/font/google";

const comfortaa = Comfortaa({
  weight: "400",
  subsets: ["latin"],
});

const inconsolata = Inconsolata({
  weight: "500",
  subsets: ["latin"],
});

interface StickyNote {
  id: string;
  content: string;
  color: string;
}

const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/${process.env.NEXT_PUBLIC_NOTES_URI}`;

export default function StickyNotesPage() {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editColor, setEditColor] = useState("");
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const [showCopyPopup, setShowCopyPopup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Color options
  const colorOptions = [
    { value: "bg-yellow-100", name: "Yellow" },
    { value: "bg-pink-200", name: "Pink" },
    { value: "bg-green-200", name: "Green" },
    { value: "bg-blue-200", name: "Blue" },
    { value: "bg-purple-200", name: "Purple" },
  ];

  // Fetch notes from API on mount
  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await fetch(API_URL, { method: "GET" });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch notes: ${response.status} ${text}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Expected an array of notes, but received: " + JSON.stringify(data));
      }
      setNotes(data as StickyNote[]);
      setError(null);
    } catch (error: any) {
      console.error("Error fetching notes:", error);
      setError(error.message);
    }
  };

  // Create a new sticky note
  const createNote = async () => {
    if (!newNoteContent.trim()) return;
    try {
      const color = getRandomColor();
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNoteContent, color }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to create note: ${response.status} ${text}`);
      }
      setNewNoteContent("");
      await fetchNotes();
      setError(null);
    } catch (error: any) {
      console.error("Error creating note:", error);
      setError(error.message);
    }
  };

  // Delete a note
  const deleteNote = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete note: ${response.status} ${text}`);
      }
      setNotes(notes.filter((note) => note.id !== id));
      if (expandedNoteId === id) setExpandedNoteId(null);
      setError(null);
    } catch (error: any) {
      console.error("Error deleting note:", error);
      setError(error.message);
    }
  };

  // Copy note content to clipboard
  const copyNote = (content: string) => {
    navigator.clipboard.writeText(content);
    setShowCopyPopup(true);
    setTimeout(() => setShowCopyPopup(false), 200);
  };

  // Save edited note
  const saveNote = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent, color: editColor }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to update note: ${response.status} ${text}`);
      }
      setNotes(
        notes.map((note) =>
          note.id === id ? { ...note, content: editContent, color: editColor } : note
        )
      );
      setExpandedNoteId(null);
      setError(null);
    } catch (error: any) {
      console.error("Error updating note:", error);
      setError(error.message);
    }
  };

  // Get random color for new notes
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

      {/* Error Display */}
      {error && (
        <div className="mb-4 text-red-600 text-center">
          Error: {error}
        </div>
      )}

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
        {notes.length === 0 ? (
          <p className="text-center text-blue-900">No notes available.</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`${
                expandedNoteId === note.id
                  ? "fixed inset-0 z-50 bg-opacity-90"
                  : "relative"
              } ${expandedNoteId === note.id ? (previewColor || editColor) : note.color} p-4 rounded-lg flex flex-col justify-between border-2 border-pink-100`}
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
                    className="w-full h-full p-2 text-2xl hover:bg-none focus:outline-none text-blue-800"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    {colorOptions.map((color) => (
                      <div
                        key={color.value}
                        className={`w-6 h-6 rounded-full cursor-pointer border-2 ${
                          editColor === color.value ? "border-pink-600" : "border-pink-300"
                        } ${color.value}`}
                        onClick={() => setEditColor(color.value)}
                        onMouseEnter={() => setPreviewColor(color.value)}
                        onMouseLeave={() => setPreviewColor(null)}
                      />
                    ))}
                  </div>
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
                  <div className="resize-none whitespace-pre-wrap break-words text-md text-blue-900 overflow-auto">
                    {note.content}
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      className="px-2 py-1 text-pink-600 hover:text-pink-800 mr-2"
                      onClick={() => {
                        setExpandedNoteId(note.id);
                        setEditContent(note.content);
                        setEditColor(note.color);
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
          ))
        )}
      </div>

      {/* Copy Popup */}
      {showCopyPopup && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 text-pink-500 px-4 py-2 rounded-lg shadow-md fade-out">
          Copied!
        </div>
      )}
    </div>
  );
}