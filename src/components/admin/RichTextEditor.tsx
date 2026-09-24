import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import {
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered,
  Link as LinkIcon, Image as ImageIcon, Youtube as YoutubeIcon,
  Minus, Undo, Redo, Unlink, LayoutGrid,
} from "lucide-react";
import { FeatureGridExtension } from "./FeatureGridExtension";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-copper underline" } }),
      Placeholder.configure({ placeholder: placeholder ?? "Write product description…" }),
      FeatureGridExtension,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value changes (e.g. switching language tabs)
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) return null;

  const btn = (active: boolean, title: string, onClick: () => void, children: React.ReactNode) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${active ? "bg-navy text-white" : "text-gray-500 hover:text-navy hover:bg-gray-100"}`}
    >
      {children}
    </button>
  );

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `product-descriptions/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { alert("Image upload failed: " + error.message); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    editor.chain().focus().setImage({ src: data.publicUrl }).run();
  };

  const addYoutube = () => {
    const url = prompt("YouTube URL:");
    if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  const addLink = () => {
    const url = prompt("URL:", editor.getAttributes("link").href ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-navy/20 focus-within:border-navy transition">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
        {btn(false, "Undo", () => editor.chain().focus().undo().run(), <Undo className="w-4 h-4" />)}
        {btn(false, "Redo", () => editor.chain().focus().redo().run(), <Redo className="w-4 h-4" />)}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {btn(editor.isActive("bold"), "Bold", () => editor.chain().focus().toggleBold().run(), <Bold className="w-4 h-4" />)}
        {btn(editor.isActive("italic"), "Italic", () => editor.chain().focus().toggleItalic().run(), <Italic className="w-4 h-4" />)}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {btn(editor.isActive("heading", { level: 1 }), "Heading 1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 className="w-4 h-4" />)}
        {btn(editor.isActive("heading", { level: 2 }), "Heading 2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="w-4 h-4" />)}
        {btn(editor.isActive("heading", { level: 3 }), "Heading 3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 className="w-4 h-4" />)}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {btn(editor.isActive("bulletList"), "Bullet list", () => editor.chain().focus().toggleBulletList().run(), <List className="w-4 h-4" />)}
        {btn(editor.isActive("orderedList"), "Numbered list", () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="w-4 h-4" />)}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {btn(editor.isActive("link"), "Add link", addLink, <LinkIcon className="w-4 h-4" />)}
        {editor.isActive("link") && btn(false, "Remove link", () => editor.chain().focus().unsetLink().run(), <Unlink className="w-4 h-4" />)}
        {btn(false, "Horizontal rule", () => editor.chain().focus().setHorizontalRule().run(), <Minus className="w-4 h-4" />)}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button
          type="button"
          title="Insert image"
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded text-gray-500 hover:text-navy hover:bg-gray-100 transition-colors"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        {btn(false, "Insert YouTube video", addYoutube, <YoutubeIcon className="w-4 h-4" />)}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button
          type="button"
          title="Insert feature grid"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({ type: "featureGrid", attrs: { features: [{ icon: "Star", title: "", desc: "" }] } })
              .run()
          }
          className="flex items-center gap-1 px-2 py-1.5 rounded text-gray-500 hover:text-copper hover:bg-gray-100 transition-colors text-xs font-medium"
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="hidden sm:inline">Features</span>
        </button>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none min-h-[160px] px-4 py-3 text-navy focus:outline-none
          [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[140px]
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left
          [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0
          [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:my-2
          [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mt-4 [&_.ProseMirror_h1]:mb-2
          [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:mb-1
          [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:mb-1
          [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5
          [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5
          [&_.ProseMirror_li]:my-0.5
          [&_.ProseMirror_hr]:border-navy/20 [&_.ProseMirror_hr]:my-3"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
      />
    </div>
  );
}
