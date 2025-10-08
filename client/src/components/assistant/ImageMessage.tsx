import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import type { Image } from '@shared/schema';

interface ImageMessageProps {
  imageUrl: string;
  aiAnalysis?: any;
  className?: string;
}

export default function ImageMessage({ imageUrl, aiAnalysis, className = '' }: ImageMessageProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  return (
    <>
      <div className={`relative inline-block ${className}`}>
        <img
          src={imageUrl}
          alt="Uploaded"
          className="max-w-[200px] max-h-[200px] rounded-lg cursor-pointer hover:opacity-90 transition"
          onClick={() => setIsLightboxOpen(true)}
        />
        {aiAnalysis && (
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" />
            AI Analyzed
          </Badge>
        )}
      </div>

      {/* Lightbox for full-size image */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-4xl">
          <img
            src={imageUrl}
            alt="Full size"
            className="w-full h-auto rounded-lg"
          />
          {aiAnalysis && aiAnalysis.analysis && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Analysis
              </h4>
              <p className="text-sm whitespace-pre-wrap">{aiAnalysis.analysis}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
