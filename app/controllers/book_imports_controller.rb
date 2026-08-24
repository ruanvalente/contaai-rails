# frozen_string_literal: true

class BookImportsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_book
  before_action :authorize_book_owner!
  before_action :set_ready_import, only: [ :show, :confirm, :destroy ]

  def new
  end

  def create
    result = ChapterImporter::Importer.import(file: params[:file], book: @book)

    if result.empty?
      Rails.logger.warn("[book_import] no_chapters_detected user=#{current_user.id} book=#{@book.id}")
      redirect_to new_book_import_path(@book),
                  alert: "Não conseguimos identificar capítulos nesse arquivo. " \
                         "Verifique se ele usa marcadores como \"Capítulo 1\"."
      return
    end

    import = nil
    ActiveRecord::Base.transaction do
      discard_stale_imports
      import = @book.book_imports.create!(
        user: current_user,
        filename: sanitized_filename,
        status: :ready,
        parsed_data: result.chapters.map(&:to_h).map(&:stringify_keys)
      )
    end

    Rails.logger.info("[book_import] ready user=#{current_user.id} book=#{@book.id} " \
                      "filename=#{import.filename} chapters=#{import.parsed_chapters.size}")

    redirect_to book_import_path(@book),
                notice: "#{import.parsed_chapters.size} capítulos encontrados. Revise antes de confirmar."
  rescue ChapterImporter::Error => e
    Rails.logger.warn("[book_import] failed user=#{current_user.id} book=#{@book.id} " \
                      "filename=#{uploaded_filename} error=#{e.class}")
    record_failed_import(e.message)

    redirect_to new_book_import_path(@book), alert: e.message
  end

  def show
  end

  def confirm
    chapters_attrs = confirm_params[:chapters].to_a.filter_map { |attrs|
      title = attrs[:title].to_s.strip
      content = attrs[:content].to_s
      next if title.blank? && content.strip.blank?

      { title: title, content: ChapterImporter::ChapterDetector.html_from_text(content) }
    }

    if chapters_attrs.empty?
      redirect_to book_import_path(@book), alert: "Adicione pelo menos um capítulo com título." and return
    end

    ActiveRecord::Base.transaction do
      chapters_attrs.each do |attrs|
        @book.chapters.create!(title: attrs[:title], content: attrs[:content])
      end
      @book_import.update!(status: :confirmed)
    end

    Rails.logger.info("[book_import] confirmed user=#{current_user.id} book=#{@book.id} " \
                      "chapters=#{chapters_attrs.size}")

    redirect_to write_book_path(@book),
                notice: "#{chapters_attrs.size} capítulos importados com sucesso."
  rescue ActiveRecord::RecordInvalid => e
    redirect_to book_import_path(@book), alert: e.record.errors.full_messages.to_sentence
  end

  def destroy
    @book_import.destroy!
    Rails.logger.info("[book_import] cancelled user=#{current_user.id} book=#{@book.id}")
    redirect_to write_book_path(@book), notice: "Importação cancelada."
  end

  private

  def set_book
    @book = Book.find(params[:book_id])
  end

  def authorize_book_owner!
    return if @book.user == current_user

    head :forbidden
  end

  def set_ready_import
    @book_import = @book.book_imports.ready.recent_first.first
    redirect_to new_book_import_path(@book), alert: "Nenhuma importação em andamento." unless @book_import
  end

  def confirm_params
    params.require(:book_import).permit(chapters: [ :title, :content ])
  end

  def discard_stale_imports
    @book.book_imports.where.not(status: :confirmed).destroy_all
  end

  def sanitized_filename
    File.basename(params[:file].original_filename.to_s).first(255)
  end

  def uploaded_filename
    return "unknown" if params[:file].blank?

    sanitized_filename.presence || "unknown"
  end

  def record_failed_import(message)
    @book.book_imports.create(
      user: current_user,
      filename: uploaded_filename,
      status: :failed,
      error_message: message
    )
  rescue StandardError => e
    Rails.logger.warn("[book_import] failed_record_not_saved book=#{@book.id} error=#{e.class}")
  end
end
