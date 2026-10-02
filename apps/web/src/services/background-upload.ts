'use client';

import { uploadQuestionImage, uploadQuizCover } from './media-upload';
import type { MediaVariantsDto } from '@brio/contracts';

export type UploadTaskState = 'uploading'|'completed'|'failed';
export interface UploadTask {
  id:string; quizId:string; questionId?:string; target:'cover'|'question';
  label:string; state:UploadTaskState; previewUrl?:string; resultUrl?:string; error?:string;
}

type MediaUploader=(quizId:string,file:File)=>Promise<MediaVariantsDto>;
type QuestionMediaUploader=(quizId:string,questionId:string,file:File)=>Promise<MediaVariantsDto>;

export class BackgroundUploadManager {
  private tasks = new Map<string,UploadTask>();
  private listeners = new Set<()=>void>();

  constructor(
    private readonly coverUploader:MediaUploader=uploadQuizCover,
    private readonly questionUploader:QuestionMediaUploader=uploadQuestionImage,
    private readonly createPreview:(file:File)=>string=(file)=>URL.createObjectURL(file),
    private readonly revokePreview:(url:string)=>void=(url)=>URL.revokeObjectURL(url)
  ){}

  subscribe(listener:()=>void) { this.listeners.add(listener); return ()=>{ this.listeners.delete(listener); }; }
  list(quizId?:string) { return [...this.tasks.values()].filter((task)=>!quizId||task.quizId===quizId); }
  dismiss(id:string) {
    const task=this.tasks.get(id);
    if(task?.previewUrl) this.revokePreview(task.previewUrl);
    this.tasks.delete(id); this.emit();
  }

  latestQuestion(quizId:string,questionId:string) {
    return this.list(quizId).filter((task)=>task.target==='question'&&task.questionId===questionId).at(-1);
  }

  enqueueCover(quizId:string,file:File) { return this.enqueue({quizId,target:'cover',label:'جاري رفع غلاف المسابقة…',file,operation:()=>this.coverUploader(quizId,file)}); }
  enqueueQuestion(quizId:string,questionId:string,file:File) { return this.enqueue({quizId,questionId,target:'question',label:'جاري رفع صورة السؤال…',file,operation:()=>this.questionUploader(quizId,questionId,file)}); }

  private enqueue(input:{quizId:string;questionId?:string;target:'cover'|'question';label:string;file:File;operation:()=>Promise<MediaVariantsDto>}) {
    const id=crypto.randomUUID();
    const previewUrl=this.createPreview(input.file);
    const base={id,quizId:input.quizId,questionId:input.questionId,target:input.target,previewUrl};
    this.tasks.set(id,{...base,label:input.label,state:'uploading'}); this.emit();
    void input.operation().then((media)=>{
      this.tasks.set(id,{...base,label:'اكتمل رفع الصورة',state:'completed',resultUrl:media.hostUrl}); this.emit();
    }).catch((cause)=>{
      this.tasks.set(id,{...base,label:'تعذر رفع الصورة، لكن تم حفظ المحتوى',state:'failed',error:cause instanceof Error?cause.message:undefined}); this.emit();
    });
    return id;
  }
  private emit(){ for(const listener of this.listeners) listener(); }
}

export const backgroundUploads = new BackgroundUploadManager();
