import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { VocabWord } from "@/types/api"

export type WeakPendingAction = {
  type: "master" | "ignore"
  word: VocabWord
}

export function WeakActionDialog({
  action,
  onOpenChange,
  onConfirm,
}: {
  action: WeakPendingAction | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const isMaster = action?.type === "master"
  const spelling = action?.word.spelling ?? ""

  return (
    <AlertDialog open={action !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {isMaster ? (
            <>
              <AlertDialogTitle>
                把「{spelling}」标记为已掌握？
              </AlertDialogTitle>
              <AlertDialogDescription>
                它会从薄弱词列表消失，下次生成文章也不再优先挑选。
                稍后可以在「全部单词」里改回来。
              </AlertDialogDescription>
            </>
          ) : (
            <>
              <AlertDialogTitle>暂时忽略「{spelling}」？</AlertDialogTitle>
              <AlertDialogDescription>
                它会从薄弱词列表消失，但不会被标记为已掌握，下次同步后可能重新出现。
              </AlertDialogDescription>
            </>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {isMaster ? "标记已掌握" : "忽略"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
