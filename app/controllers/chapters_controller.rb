class ChaptersController < ApplicationController
  before_action :authenticate_user!
  before_action :set_book
  before_action :authorize_book_owner!
  before_action :set_chapter, only: [ :show, :update, :destroy ]

  def index
    @chapters = @book.chapters.ordered
    render json: @chapters
  end

  def show
    render json: @chapter
  end

  def create
    @chapter = @book.chapters.build(chapter_params)

    if @chapter.save
      render json: @chapter, status: :created
    else
      render json: { errors: @chapter.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @chapter.update(chapter_params)
      render json: @chapter
    else
      render json: { errors: @chapter.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @chapter.destroy
    head :no_content
  end

  def reorder
    raw_ids = Array(params[:ordered_ids])
    valid_ids = raw_ids.all? { |id| id.is_a?(Integer) || (id.is_a?(String) && id.match?(/\A\d+\z/)) }
    return render json: { error: "Ordem inválida" }, status: :unprocessable_entity unless valid_ids

    ordered_ids = raw_ids.map(&:to_i)
    chapters = @book.chapters

    ActiveRecord::Base.transaction do
      chapters_by_id = chapters.lock.index_by(&:id)
      return render json: { error: "Ordem inválida" }, status: :unprocessable_entity unless ordered_ids.sort == chapters_by_id.keys.sort

      ordered_ids.each_with_index do |id, position|
        chapters_by_id.fetch(id).update_column(:position, position)
      end
    end

    render json: chapters.ordered
  end

  private

  def set_book
    @book = Book.find(params[:book_id])
  end

  def set_chapter
    @chapter = @book.chapters.find(params[:id])
  end

  def authorize_book_owner!
    return if @book.user == current_user

    render json: { error: "Não autorizado" }, status: :forbidden
  end

  def chapter_params
    params.require(:chapter).permit(:title, :content)
  end
end
