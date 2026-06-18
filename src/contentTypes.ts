export type BaseId = 1 | 3

export type ContentItem = {
  id: string
  title: string
  fileList: string[]
  description: string
  chapter?: string
  id_map?: number
  base_id?: BaseId
  mediaLink?: string
}
