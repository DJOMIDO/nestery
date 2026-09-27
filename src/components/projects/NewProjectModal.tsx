// src/components/projects/NewProjectModal.tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// Project as returned by /api/projects (see src/db/schema.ts)
export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  startDate: string | null;
  dueDate: string | null;
  visibility: 'public' | 'private';
  tags: string[];
  status: 'planned' | 'in_progress' | 'completed' | 'archived';
  progress: number;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export default function NewProjectModal({
  isOpen,
  onClose,
  onCreated,
}: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const payload = {
        name,
        description: description || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        visibility,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: Project & { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Create failed');
      }
      onCreated(data as Project);
      // reset form
      setName('');
      setDescription('');
      setStartDate('');
      setDueDate('');
      setVisibility('private');
      setTags('');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              className="mt-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="project-desc">Description</Label>
            <Textarea
              id="project-desc"
              className="mt-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="project-start">Start Date</Label>
              <Input
                id="project-start"
                className="mt-2"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="project-due">Due Date</Label>
              <Input
                id="project-due"
                className="mt-2"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="project-visibility" className="mb-2">Visibility</Label>
              <Select
                onValueChange={(val) => setVisibility(val as 'public' | 'private')}
                value={visibility}
              >
                <SelectTrigger id="project-visibility" className="mt-2">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="project-tags">Tags (comma separated)</Label>
              <Input
                id="project-tags"
                className="mt-2"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2"
              />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <DialogFooter className="flex justify-end space-x-4">
            <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
